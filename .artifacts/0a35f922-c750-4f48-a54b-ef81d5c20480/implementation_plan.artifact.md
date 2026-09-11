# Implementation Plan - Liquid Login Menu

Transform the login portal selection screen into a fluid, grid-based "liquid" menu with compact buttons.

## Proposed Changes

### [Component] Login Selection Screen
#### [MODIFY] [index.tsx](file:///C:/Users/Administrator/EduEaz/app/(auth)/login/index.tsx)
- **Responsive Grid**: Replace the single-column list with a 2-column grid layout using `flexWrap: 'wrap'`.
- **Compact Cards**:
    - Change card layout from horizontal (row) to vertical (column).
    - Reduce `padding` from `16` to `12`.
    - Shrink `iconBox` from `60x60` to `44x44`.
    - Reduce `optTitle` font size from `17` to `14`.
- **"Liquid" Animations**:
    - Use `Animatable.View` with staggered delays to give a fluid entrance effect.
    - Add a subtle pulse or bounce to the icons.
- **Dynamic Sizing**: Use `useWindowDimensions` to calculate card widths based on screen size (ensuring they fit 2-across on small devices).

## Verification Plan

### Manual Verification
- Test on a small mobile device (e.g., iPhone SE/Android small) to ensure 2-column grid fits.
- Test on a tablet or web browser to see the grid expand.
- Verify that tapping each card still navigates to the correct login portal.
