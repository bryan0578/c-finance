import Image from 'next/image';
import { cn } from '@/lib/utils';

export function CFinanceLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/c-finance-logo.svg"
      alt="C-Finance"
      width={256}
      height={256}
      priority={priority}
      className={cn('shrink-0', className)}
    />
  );
}
