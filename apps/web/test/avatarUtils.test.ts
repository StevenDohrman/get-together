import { AVATAR_GRADIENT_STOPS, initialsFor, pickGradient } from '@/lib/avatarUtils';

describe('avatarUtils', () => {
    it('builds initials from the first two name parts', () => {
        expect(initialsFor('Alaris Peterson')).toBe('AP');
        expect(initialsFor('  tristan   biesemeier  uwb ')).toBe('TB');
    });

    it('falls back to a question mark when there is no displayable name', () => {
        expect(initialsFor('')).toBe('?');
        expect(initialsFor('     ')).toBe('?');
    });

    it('keeps single-letter initials uppercased', () => {
        expect(initialsFor('steven')).toBe('S');
    });

    it('picks a stable gradient from the known palette', () => {
        expect(pickGradient('same-user')).toBe(pickGradient('same-user'));
        expect(AVATAR_GRADIENT_STOPS).toContain(pickGradient('same-user'));
    });
});
