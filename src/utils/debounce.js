/**
 * Debounce utility - delays function execution until after a specified wait time
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Milliseconds to wait before executing
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
