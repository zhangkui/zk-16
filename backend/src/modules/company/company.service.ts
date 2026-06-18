import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Company, CompanyStatus } from './company.entity';
import { User, UserRole, UserStatus } from '../auth/user.entity';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  QueryCompanyDto,
  CreateCompanyUserDto,
} from './company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<{ company: Company; adminUser: User }> {
    const { name, adminUsername, adminPassword, adminRealName, ...rest } = createCompanyDto;

    const existingCompany = await this.companyRepository.findOne({ where: { name } });
    if (existingCompany) {
      throw new ConflictException(`公司名称 "${name}" 已存在`);
    }

    const existingUser = await this.userRepository.findOne({ where: { username: adminUsername } });
    if (existingUser) {
      throw new ConflictException(`用户名 "${adminUsername}" 已存在`);
    }

    const company = this.companyRepository.create({
      name,
      ...rest,
      status: CompanyStatus.ACTIVE,
    });
    const savedCompany = await this.companyRepository.save(company);

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = this.userRepository.create({
      username: adminUsername,
      password: hashedPassword,
      realName: adminRealName || name + '管理员',
      role: UserRole.COMPANY_SUPER_ADMIN,
      companyId: savedCompany.id,
      isCompanySuperAdmin: true,
      status: UserStatus.ACTIVE,
    });
    const savedAdminUser = await this.userRepository.save(adminUser);
    delete savedAdminUser.password;

    return { company: savedCompany, adminUser: savedAdminUser };
  }

  async findAll(queryCompanyDto: QueryCompanyDto): Promise<{
    list: Company[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { name, status, page = 1, pageSize = 10 } = queryCompanyDto;

    const queryBuilder = this.companyRepository.createQueryBuilder('company');

    if (name) {
      queryBuilder.andWhere('company.name LIKE :name', { name: `%${name}%` });
    }

    if (status) {
      queryBuilder.andWhere('company.status = :status', { status });
    }

    queryBuilder.orderBy('company.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return { list, total, page, pageSize };
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`公司ID ${id} 不存在`);
    }
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);

    if (updateCompanyDto.name && updateCompanyDto.name !== company.name) {
      const existing = await this.companyRepository.findOne({ where: { name: updateCompanyDto.name } });
      if (existing) {
        throw new ConflictException(`公司名称 "${updateCompanyDto.name}" 已存在`);
      }
    }

    Object.assign(company, updateCompanyDto);
    return this.companyRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);

    const userCount = await this.userRepository.count({ where: { companyId: id } });
    if (userCount > 0) {
      throw new BadRequestException('该公司下还有用户，无法删除');
    }

    await this.companyRepository.remove(company);
  }

  async getCompanyUsers(
    companyId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ list: User[]; total: number; page: number; pageSize: number }> {
    await this.findOne(companyId);

    const queryBuilder = this.userRepository.createQueryBuilder('user');
    queryBuilder.andWhere('user.companyId = :companyId', { companyId });
    queryBuilder.orderBy('user.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    list.forEach((user) => delete user.password);

    return { list, total, page, pageSize };
  }

  async createCompanyUser(
    companyId: string,
    createCompanyUserDto: CreateCompanyUserDto,
  ): Promise<User> {
    await this.findOne(companyId);

    const { username, password, realName, phone, email } = createCompanyUserDto;

    const existingUser = await this.userRepository.findOne({ where: { username } });
    if (existingUser) {
      throw new ConflictException(`用户名 "${username}" 已存在`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      realName,
      role: UserRole.COMPANY_ADMIN,
      companyId,
      isCompanySuperAdmin: false,
      phone,
      email,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);
    delete savedUser.password;
    return savedUser;
  }

  async deleteCompanyUser(companyId: string, userId: string): Promise<void> {
    await this.findOne(companyId);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.companyId !== companyId) {
      throw new ForbiddenException('该用户不属于当前公司');
    }

    if (user.isCompanySuperAdmin) {
      throw new BadRequestException('公司超级管理员不能被删除');
    }

    await this.userRepository.delete(userId);
  }

  async getCompanyVehicleCount(companyId: string): Promise<number> {
    const { Vehicle } = await import('../vehicle/vehicle.entity');
    const vehicleRepository = this.companyRepository.manager.getRepository(Vehicle);
    return vehicleRepository.count({ where: { companyId } });
  }
}
