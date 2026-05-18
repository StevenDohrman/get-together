'use client';

export default function Logo() {
    return (
        <div className="flex flex-col items-start gap-2">
            {/* Logo Container */}
            <div className="flex items-center gap-3">
                {/* Logo Image */}
                <img
                    src="/assets/logo.png"
                    alt="UConnect Logo"
                    className="w-10 h-10 object-contain"
                />
            </div>
        </div>
    );
}
