import { useState, useCallback, useRef } from 'react';

const SwipeableAside = ({ children, className = '', position = 'right', isOpen = false, onClose, minSwipeDistance = 75, forwardedRef, ...props }) => {
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startY = useRef(null);

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;

    const handleClose = useCallback(() => {
        setSwipeOffset(0);
        setIsSwiping(false);
        setTouchStart(null);
        setTouchEnd(null);
        onClose?.();
    }, [onClose]);

    const resetSwipeState = useCallback(() => {
        setSwipeOffset(0);
        setIsSwiping(false);
        setTouchStart(null);
        setTouchEnd(null);
    }, []);

    const onTouchStart = useCallback((e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        startY.current = e.targetTouches[0].clientY;
        setIsSwiping(false);
    }, []);

    const onTouchMove = useCallback((e) => {
        if (touchStart === null) return;
        const currentX = e.targetTouches[0].clientX;
        const currentY = e.targetTouches[0].clientY;
        const diffX = currentX - touchStart;
        const diffY = Math.abs(currentY - startY.current);
        //Only consider horizontal swipes (ignore vertical scrolling)
        if (Math.abs(diffX) > diffY && Math.abs(diffX) > 10) {
            setIsSwiping(true);
        }
        setTouchEnd(currentX);
        //Update visual offset based on position
        if (isSwiping) {
            const validOffset = position === 'left' ? diffX < 0 : diffX > 0;
            if (validOffset) {
                setSwipeOffset(diffX);
            }
        }
    }, [touchStart, isSwiping, position]);

    const onTouchEnd = useCallback(() => {
        if (!touchStart || !touchEnd) {
            resetSwipeState();
            return;
        }
        const distance = touchEnd - touchStart;
        const isValidSwipe = position === 'left'
            ? distance < -minSwipeDistance
            : distance > minSwipeDistance;
        if (isValidSwipe) {
            handleClose();
        } else {
            resetSwipeState();
        }
    }, [touchStart, touchEnd, position, minSwipeDistance, handleClose, resetSwipeState]);

    const shouldApplySwipe = isMobile() && isOpen;

    const style = shouldApplySwipe && swipeOffset !== 0
        ? { transform: `translateX(${swipeOffset}px)`, transition: 'none' }
        : {};

    const classes = [
        className,
        isSwiping ? 'swiping' : ''
    ].filter(Boolean).join(' ');

    const touchHandlers = shouldApplySwipe ? {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    } : {};

    return (
        <aside 
            className={classes}
            style={style}
            ref={forwardedRef}
            {...touchHandlers}
            {...props}
        >
            {children}
        </aside>
    );
};

export default SwipeableAside;