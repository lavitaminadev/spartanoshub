import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { EmailService } from '../../core/notifications/email.service';

@Injectable()
export class ResetUserPasswordUseCase {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly email: EmailService,
  ) {}

  async execute(params: { id: string; organizationId: string; actorRole: UserRole; sendEmail?: boolean }) {
    const user = await this.users.findOne({ where: { id: params.id, organizationId: params.organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.generarYEnviar(user, params);
  }

  /**
   * Reenvía el correo de acceso a quien todavía no puso su propia contraseña.
   *
   * La clave no se puede reenviar tal cual —se guarda cifrada—, así que se genera otra y la
   * anterior deja de valer. Solo con la temporal pendiente: a quien ya eligió la suya no se le
   * cambia por aquí. No devuelve la clave: quien reenvía no la ve, solo sabe si salió el correo.
   */
  async reenviarAcceso(params: { id: string; organizationId: string; actorRole: UserRole }): Promise<{ userId: string; emailSent: boolean }> {
    const user = await this.users.findOne({ where: { id: params.id, organizationId: params.organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.mustChangePassword) throw new BadRequestException('Esta persona ya eligió su propia contraseña: no hay acceso pendiente que reenviar.');
    if (params.actorRole !== UserRole.DEV && [UserRole.DEV, UserRole.ADMIN].includes(user.role)) {
      throw new ForbiddenException('No puedes reenviar el acceso de esta cuenta');
    }
    const { emailSent } = await this.generarYEnviar(user, { ...params, sendEmail: true });
    return { userId: user.id, emailSent };
  }

  private async generarYEnviar(user: User, params: { actorRole: UserRole; sendEmail?: boolean }) {
    if (params.actorRole === UserRole.OPERATIONS_DIRECTOR && [UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR].includes(user.role)) {
      throw new ForbiddenException('No puedes resetear esta cuenta');
    }

    const temporaryPassword = randomBytes(18).toString('base64url');
    user.password = await bcrypt.hash(temporaryPassword, Number(process.env.BCRYPT_ROUNDS || 10));
    user.mustChangePassword = true;
    // `JwtStrategy` rechaza los tokens emitidos antes de esta marca. Actualizarla invalida
    // los access tokens ya entregados, que de otro modo seguirían siendo válidos hasta
    // expirar aunque se revoque el token de renovación.
    user.passwordChangedAt = new Date();
    user.refreshToken = null;
    await this.users.save(user);

    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const emailSent = params.sendEmail !== false && await this.email.sendTemporaryPassword(
      user.name,
      user.email,
      temporaryPassword,
      `${appUrl}/login`,
      user.organizationId,
    );

    return { userId: user.id, temporaryPassword, emailSent, mustChangePassword: true };
  }
}
