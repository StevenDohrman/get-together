import Image from 'next/image';

type LogoProps = {
    className?: string;
};

export default function Logo({ className }: LogoProps) {
    return (
        <div className="flex flex-col items-start gap-2">
            {/* Logo Container */}
            <div className="flex items-center gap-3">
                {/* Logo Image */}
                <Image src="/assets/logo.svg" alt="UConnect Logo" width={40} height={40} className={`h-10 w-10 object-contain${className ? ` ${className}` : ''}`} priority />
            </div>
        </div>
    );
}
