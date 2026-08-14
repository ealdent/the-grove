import { jest } from '@jest/globals';
import { saveTodosToLocal } from '../app.js';

describe('saveTodosToLocal', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        // Clear mocks before each test
        jest.clearAllMocks();

        // Spy on console.error
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should catch errors when localStorage.setItem throws and log to console.error', () => {
        // Mock localStorage.setItem to throw an error
        const mockError = new Error('QuotaExceededError');
        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw mockError;
        });

        saveTodosToLocal();

        expect(setItemSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save todos', mockError);

        setItemSpy.mockRestore();
    });
});
