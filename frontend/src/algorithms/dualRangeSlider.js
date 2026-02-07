import React from 'react';
import { useCallback, useRef, useState } from 'react';

export const DualRangeSlider = ({ min = 0, max = 100, value = [25, 75], onChange, formatValue = (val) => val }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [activeHandle, setActiveHandle] = useState(null);
    const trackRef = useRef(null);

    const handleMouseDown = useCallback((e, handle) => {
        e.preventDefault();
        setIsDragging(true);
        setActiveHandle(handle);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !activeHandle || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const newValue = Math.round((percentage / 100) * (max - min) + min);
        if (activeHandle === 'min') {
            const newMin = Math.min(newValue, value[1] - 1);
            onChange([newMin, value[1]]);
        } else {
            const newMax = Math.max(newValue, value[0] + 1);
            onChange([value[0], newMax]);
        }
    }, [isDragging, activeHandle, min, max, value, onChange]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setActiveHandle(null);
    }, []);

    const handleTrackClick = useCallback((e) => {
        if (isDragging) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        const clickValue = Math.round((percentage / 100) * (max - min) + min);
        const minDistance = Math.abs(clickValue - value[0]);
        const maxDistance = Math.abs(clickValue - value[1]);
        if (minDistance < maxDistance) {
            const newMin = Math.min(clickValue, value[1] - 1);
            onChange([newMin, value[1]]);
        } else {
            const newMax = Math.max(clickValue, value[0] + 1);
            onChange([value[0], newMax]);
        }
    }, [isDragging, min, max, value, onChange]);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const minPercent = ((value[0] - min) / (max - min)) * 100;
    const maxPercent = ((value[1] - min) / (max - min)) * 100;

    return (
        <div className="dual-slider">
            <div ref={trackRef} className="dual-slider__track" onClick={handleTrackClick}>
                <div 
                    className="dual-slider__range" 
                    style={{ 
                        left: `${minPercent}%`, 
                        width: `${maxPercent - minPercent}%` 
                    }} 
                />
                <div className="dual-slider__handle" style={{ left: `${minPercent}%` }} onMouseDown={(e) => handleMouseDown(e, 'min')} />
                <div className="dual-slider__handle" style={{ left: `${maxPercent}%` }} onMouseDown={(e) => handleMouseDown(e, 'max')} />
            </div>
            <div className="dual-slider__values">
                <span>{formatValue(value[0], 'min')}</span>
                <span>{formatValue(value[1], 'max')}</span>
            </div>
        </div>
    );
};