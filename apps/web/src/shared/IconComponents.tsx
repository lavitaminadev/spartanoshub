import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';
import { VitaIcons, type VitaIconName } from './Icons';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ className?: string }>;
  label: string;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function IconButton({ icon: IconComponent, label, variant = 'primary', size = 'md', className = '', ...props }: IconButtonProps) {
  return (
    <button {...props} className={`icon-button icon-button-${size} icon-button-${variant} ${className}`.trim()}>
      <IconComponent className="icon-button-icon" />
      <span>{label}</span>
    </button>
  );
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: VitaIconName;
  size?: 'sm' | 'md' | 'lg';
}

export function Icon({ name, className = '', size = 'md', ...props }: IconProps) {
  const IconComponent = VitaIcons[name];
  return <IconComponent className={`icon icon-${size} ${className}`.trim()} {...props} />;
}
