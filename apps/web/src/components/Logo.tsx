import Image from 'next/image';

export default function Logo() {
    return (
        <div className="flex flex-col items-start gap-2">
            {/* Logo Container */}
            <div className="flex items-center gap-3">
                {/* Logo Image */}
                <Image src="/assets/logo.png" alt="UConnect Logo" width={40} height={40} className="h-10 w-10 object-contain" priority />
            </div>
        </div>
    );
}
