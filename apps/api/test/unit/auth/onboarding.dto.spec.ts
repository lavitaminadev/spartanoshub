import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CompleteOnboardingDto, REQUIRED_CONSENTS } from '../../../src/core/auth/dto/onboarding.dto';

const validPayload = {
  newPassword: 'NuevaClave123!',
  acceptedConsents: [...REQUIRED_CONSENTS],
  profile: { name: 'Demo Vitalis', phone: '+56 9 1234 5678' },
};

function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

describe('CompleteOnboardingDto', () => {
  it('acepta el perfil anidado del primer acceso', async () => {
    const dto = plainToInstance(CompleteOnboardingDto, validPayload);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(messages(errors)).toEqual([]);
  });

  it('rechaza modalidad laboral porque la define administración', async () => {
    const dto = plainToInstance(CompleteOnboardingDto, {
      ...validPayload,
      profile: { ...validPayload.profile, workMode: 'remote' },
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(messages(errors)).toContain('property workMode should not exist');
  });

  it('exige todos los consentimientos y una contraseña segura', async () => {
    const dto = plainToInstance(CompleteOnboardingDto, {
      ...validPayload,
      newPassword: 'debil',
      acceptedConsents: ['terms'],
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(messages(errors).length).toBeGreaterThanOrEqual(2);
  });
});
