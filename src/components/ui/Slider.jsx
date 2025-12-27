import { twMerge } from 'tailwind-merge';

export const Slider = ({ value, min = 0, max = 100, onChange, className }) => {
    return (
        <div className={twMerge("relative w-full h-6 flex items-center group", className)}>
            {/* Track background */}
            <div className="absolute w-full h-1 bg-white/20 rounded-full overflow-hidden">
                {/* Fill */}
                <div
                    className="h-full bg-primary transition-all duration-100 ease-out"
                    style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                />
            </div>

            {/* Input (Invisible but interactive) */}
            <input
                type="range"
                min={min}
                max={max}
                step={0.1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {/* Thumb (Visual) */}
            <div
                className="pointer-events-none absolute w-4 h-4 bg-white rounded-full shadow-lg transform -translate-x-1/2 transition-transform duration-100 group-active:scale-110"
                style={{ left: `${((value - min) / (max - min)) * 100}%` }}
            />
        </div>
    );
};
