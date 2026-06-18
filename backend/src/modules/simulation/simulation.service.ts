import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle, VehicleStatus } from '../vehicle/vehicle.entity';
import { TrackService } from '../track/track.service';
import { MqttService } from '../../mqtt/mqtt.service';

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

  private readonly BEIJING_ROAD_NETWORK = [
    { lng: 116.397, lat: 39.908 },
    { lng: 116.405, lat: 39.910 },
    { lng: 116.415, lat: 39.905 },
    { lng: 116.420, lat: 39.912 },
    { lng: 116.410, lat: 39.920 },
    { lng: 116.395, lat: 39.918 },
    { lng: 116.388, lat: 39.910 },
    { lng: 116.400, lat: 39.898 },
    { lng: 116.412, lat: 39.895 },
    { lng: 116.425, lat: 39.900 },
    { lng: 116.430, lat: 39.915 },
    { lng: 116.418, lat: 39.925 },
    { lng: 116.403, lat: 39.922 },
    { lng: 116.390, lat: 39.915 },
    { lng: 116.385, lat: 39.905 },
    { lng: 116.392, lat: 39.895 },
    { lng: 116.408, lat: 39.890 },
    { lng: 116.422, lat: 39.892 },
    { lng: 116.432, lat: 39.905 },
    { lng: 116.428, lat: 39.920 },
  ];

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    private readonly trackService: TrackService,
    @Optional() private readonly mqttService: MqttService,
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

  async startVehicleSimulation(plateNumber: string): Promise<{ active: boolean; plateNumber: string }> {
    let vehicle = this.simulatedVehicles.get(plateNumber);
    if (!vehicle) {
      vehicle = this.createSimulatedVehicle(plateNumber);
      this.simulatedVehicles.set(plateNumber, vehicle);
    }
    vehicle.active = true;

    if (!this.isRunning) {
      this.isRunning = true;
      this.startSimulationLoop();
    }

    this.logger.log(`Simulation started for vehicle ${plateNumber}`);
    return { active: true, plateNumber };
  }

  stopVehicleSimulation(plateNumber: string): { active: boolean; plateNumber: string } {
    const vehicle = this.simulatedVehicles.get(plateNumber);
    if (vehicle) {
      vehicle.active = false;
      this.logger.log(`Simulation stopped for vehicle ${plateNumber}`);
    }

    const activeVehicles = Array.from(this.simulatedVehicles.values()).filter((v) => v.active);
    if (activeVehicles.length === 0) {
      this.isRunning = false;
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }
    }

    return { active: false, plateNumber };
  }

  isVehicleSimulating(plateNumber: string): boolean {
    const vehicle = this.simulatedVehicles.get(plateNumber);
    return vehicle?.active === true;
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
    const waypointIndex = Math.floor(Math.random() * this.BEIJING_ROAD_NETWORK.length);
    const waypoint = this.BEIJING_ROAD_NETWORK[waypointIndex];
    const jitter = 0.002;
    const startLng = waypoint.lng + (Math.random() - 0.5) * jitter;
    const startLat = waypoint.lat + (Math.random() - 0.5) * jitter;

    const nextWaypointIndex = (waypointIndex + 1 + Math.floor(Math.random() * 3)) % this.BEIJING_ROAD_NETWORK.length;
    const nextWaypoint = this.BEIJING_ROAD_NETWORK[nextWaypointIndex];

    return {
      plateNumber,
      currentLng: startLng,
      currentLat: startLat,
      speed: 30 + Math.random() * 30,
      direction: 0,
      targetLng: nextWaypoint.lng + (Math.random() - 0.5) * jitter,
      targetLat: nextWaypoint.lat + (Math.random() - 0.5) * jitter,
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
      const nearestIndex = this.findNearestWaypoint(vehicle.currentLng, vehicle.currentLat);
      const nextIndex = (nearestIndex + 1 + Math.floor(Math.random() * 3)) % this.BEIJING_ROAD_NETWORK.length;
      const nextWaypoint = this.BEIJING_ROAD_NETWORK[nextIndex];
      const jitter = 0.002;
      vehicle.targetLng = nextWaypoint.lng + (Math.random() - 0.5) * jitter;
      vehicle.targetLat = nextWaypoint.lat + (Math.random() - 0.5) * jitter;
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

  private findNearestWaypoint(lng: number, lat: number): number {
    let minDist = Infinity;
    let nearestIndex = 0;
    for (let i = 0; i < this.BEIJING_ROAD_NETWORK.length; i++) {
      const wp = this.BEIJING_ROAD_NETWORK[i];
      const dist = Math.sqrt((wp.lng - lng) ** 2 + (wp.lat - lat) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }
    return nearestIndex;
  }

  private async reportTrackPoint(vehicle: SimulatedVehicle) {
    const timestamp = new Date().toISOString();
    const trackData = {
      longitude: vehicle.currentLng,
      latitude: vehicle.currentLat,
      plateNumber: vehicle.plateNumber,
      speed: vehicle.speed,
      direction: vehicle.direction,
      altitude: 50 + Math.random() * 20,
      accuracy: 5 + Math.random() * 5,
      timestamp,
    };

    try {
      await this.trackService.create(trackData);
    } catch (error) {
      this.logger.error(`Failed to report track point for ${vehicle.plateNumber}:`, error.message);
    }

    if (this.mqttService && this.mqttService.isConnected()) {
      try {
        await this.mqttService.publishVehicleData({
          ...trackData,
          vehicleStatus: 'online',
        });
      } catch (error) {
        this.logger.error(`Failed to publish MQTT data for ${vehicle.plateNumber}:`, error.message);
      }
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
