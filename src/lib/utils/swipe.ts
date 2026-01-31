export type SwipeOptions = {
	threshold?: number;
	restraint?: number;
	allowedTime?: number;
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
};

export function swipe(node: HTMLElement, options: SwipeOptions = {}) {
	let startX = 0;
	let startY = 0;
	let startTime = 0;

	const threshold = options.threshold ?? 60;
	const restraint = options.restraint ?? 80;
	const allowedTime = options.allowedTime ?? 500;

	const handleTouchStart = (event: TouchEvent) => {
		if (event.touches.length > 1) return;
		const touch = event.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		startTime = Date.now();
	};

	const handleTouchEnd = (event: TouchEvent) => {
		const touch = event.changedTouches[0];
		const distX = touch.clientX - startX;
		const distY = touch.clientY - startY;
		const elapsed = Date.now() - startTime;

		if (elapsed > allowedTime) return;
		if (Math.abs(distX) < threshold) return;
		if (Math.abs(distY) > restraint) return;

		if (distX < 0) {
			options.onSwipeLeft?.();
		} else {
			options.onSwipeRight?.();
		}
	};

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchend', handleTouchEnd, { passive: true });

	return {
		update(newOptions: SwipeOptions) {
			options = { ...options, ...newOptions };
		},
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchend', handleTouchEnd);
		}
	};
}
