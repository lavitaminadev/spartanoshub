import { Injectable } from '@nestjs/common';
import { LeadIntakeService } from '../lead-intake.service';

@Injectable()
export class CreateLeadUseCase {
  constructor(
    private readonly leadIntake: LeadIntakeService,
  ) {}

  async execute(data: {
    organizationId: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    sourceDetail?: string;
    notes?: string;
    estimatedAmount?: number;
    trafficLight?: 'green' | 'yellow' | 'red';
    clientId?: string;
    domain?: 'audience' | 'commercial';
  }) {
    // Esta ruta solo se alcanza con sesión abierta: quien llega acá escribió el prospecto en el
    // tablero. El scoring no debe descartarlo por no traer las señales de un origen automático.
    return this.leadIntake.captureLead({ ...data, enteredByPerson: true });
  }
}
