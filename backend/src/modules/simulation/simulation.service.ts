import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle, VehicleStatus } from '../vehicle/vehicle.entity';
import { TrackService } from '../track/track.service';

export interface SimulatedVehicle {
  plateNumber: string;
  currentLng: number;
  currentLat: number;
  speed: number;
  direction: number;
  targetLng: number;
  targetLat: number;
  active: boolean;
}

@Injectable()
export class SimulationService implements OnModuleInit {
  private readonly logger = new Logger(SimulationService.name);
  private simulatedVehicles: Map<string, SimulatedVehicle> = new Map();
  private simulationInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalMs = 3000;

  private readonly defaultCenter = { lng: 116.4074, lat: 39.9042 };
  private readonly defaultRadius = 0.05;

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    private readonly trackService: TrackService,
  ) {}

  onModuleInit() {
    this.logger.log('Simulation service initialized');
  }

  async startSimulation(plateNumbers?: string[], intervalMs?: number): Promise<{ running: boolean; vehicles: string[] }> {
    if (this.isRunning) {
      return { running: true, vehicles: Array.from(this.simulatedVehicles.keys()) };
    }

    if (intervalMs && intervalMs > 0) {
      this.intervalMs = intervalMs;
    }

    let vehiclesToSimulate: string[] = [];

    if (plateNumbers && plateNumbers.length > 0) {
      vehiclesToSimulate = plateNumbers;
    } else {
      const approvedVehicles = await this.vehicleRepository.find({
        where: { status: VehicleStatus.APPROVED },
        take: 5,
      });
      vehiclesToSimulate = approvedVehicles.map((v) => v.plateNumber);
    }

    if (vehiclesToSimulate.length === 0) {
      vehiclesToSimulate = ['京A12345', '京B67890', '京C11111'];
    }

    for (const plateNumber of vehiclesToSimulate) {
      const vehicle = this.simulatedVehicles.get(plateNumber) || this.createSimulatedVehicle(plateNumber);
      vehicle.active = true;
      this.simulatedVehicles.set(plateNumber, vehicle);
    }

    this.isRunning = true;
    this.startSimulationLoop();

    this.logger.log(`Simulation started with ${vehiclesToSimulate.length} vehicles`);
    return { running: true, vehicles: vehiclesToSimulate };
  }

  stopSimulation(): { running: boolean; vehicles: string[] } {
    this.isRunning = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    for (const vehicle of this.simulatedVehicles.values()) {
      vehicle.active = false;
    }

    this.logger.log('Simulation stopped');
    return { running: false, vehicles: Array.from(this.simulatedVehicles.keys()) };
  }

  getSimulationStatus(): { running: boolean; vehicles: SimulatedVehicle[]; intervalMs: number } {
    return {
      running: this.isRunning,
      vehicles: Array.from(this.simulatedVehicles.values()),
      intervalMs: this.intervalMs,
    };
  }

  async addSimulatedVehicle(plateNumber: string): Promise<SimulatedVehicle> {
    let vehicle = this.simulatedVehicles.get(plateNumber);
    if (!vehicle) {
      vehicle = this.createSimulatedVehicle(plateNumber);
      vehicle.active = this.isRunning;
      this.simulatedVehicles.set(plateNumber, vehicle);
    }
    return vehicle;
  }

  removeSimulatedVehicle(plateNumber: string): boolean {
    return this.simulatedVehicles.delete(plateNumber);
  }

  updateVehicleTarget(plateNumber: string, lng: number, lat: number): SimulatedVehicle | null {
    const vehicle = this.simulatedVehicles.get(plateNumber);
    if (vehicle) {
      vehicle.targetLng = lng;
      vehicle.targetLat = lat;
      return vehicle;
    }
    return null;
  }

  private createSimulatedVehicle(plateNumber: string): SimulatedVehicle {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.defaultRadius;
    const startLng = this.defaultCenter.lng + Math.cos(angle) * distance;
    const startLat = this.defaultCenter.lat + Math.sin(angle) * distance;

    const targetAngle = Math.random() * Math.PI * 2;
    const targetDistance = Math.random() * this.defaultRadius * 0.5;
    const targetLng = this.defaultCenter.lng + Math.cos(targetAngle) * targetDistance;
    const targetLat = this.defaultCenter.lat + Math.sin(targetAngle) * targetDistance;

    return {
      plateNumber,
      currentLng: startLng,
      currentLat: startLat,
      speed: 30 + Math.random() * 30,
      direction: Math.random() * 360,
      targetLng,
      targetLat,
      active: false,
    };
  }

  private startSimulationLoop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }

    this.simulationInterval = setInterval(() => {
      if (!this.isRunning) return;
      this.tick();
    }, this.intervalMs);
  }

  private async tick() {
    const activeVehicles = Array.from(this.simulatedVehicles.values()).filter((v) => v.active);

    for (const vehicle of activeVehicles) {
      try {
        this.moveVehicle(vehicle);
        await this.reportTrackPoint(vehicle);
      } catch (error) {
        this.logger.error(`Error simulating vehicle ${vehicle.plateNumber}:`, error);
      }
    }
  }

  private moveVehicle(vehicle: SimulatedVehicle) {
    const dx = vehicle.targetLng - vehicle.currentLng;
    const dy = vehicle.targetLat - vehicle.currentLat;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.001) {
      const angle = Math.random() * Math.PI * 2;
      const targetDistance = 0.01 + Math.random() * 0.03;
      vehicle.targetLng = vehicle.currentLng + Math.cos(angle) * targetDistance;
      vehicle.targetLat = vehicle.currentLat + Math.sin(angle) * targetDistance;
      return;
    }

    const speedFactor = (vehicle.speed / 3.6) * (this.intervalMs / 1000) / 111000;
    const moveDistance = Math.min(speedFactor, distance);
    const ratio = moveDistance / distance;

    vehicle.currentLng += dx * ratio;
    vehicle.currentLat += dy * ratio;
    vehicle.direction = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (vehicle.direction < 0) vehicle.direction += 360;
  }

  private async reportTrackPoint(vehicle: SimulatedVehicle) {
    try {
      await this.trackService.create({
        longitude: vehicle.currentLng,
        latitude: vehicle.currentLat,
        plateNumber: vehicle.plateNumber,
        speed: vehicle.speed,
        direction: vehicle.direction,
        altitude: 50 + Math.random() * 20,
        accuracy: 5 + Math.random() * 5,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to report track point for ${vehicle.plateNumber}:`, error.message);
    }
  }

  setSimulationSpeed(plateNumber: string, speed: number): SimulatedVehicle | null {
    const vehicle = this.simulatedVehicles.get(plateNumber);
    if (vehicle) {
      vehicle.speed = Math.max(0, Math.min(120, speed));
      return vehicle;
    }
    return null;
  }

  async resetSimulation(): Promise<{ running: boolean; vehicles: string[] }> {
    this.stopSimulation();
    this.simulatedVehicles.clear();
    return { running: false, vehicles: [] };
  }
}
