import { Stack } from 'expo-router';

type TabStackTitleProps = {
  /** Must match `NativeTabs.Trigger.Label` and stack `_layout` title. */
  title: string;
  large?: boolean;
};

/**
 * After scroll root — native `title` (+ optional large title).
 */
export function TabStackTitle({ title, large = true }: TabStackTitleProps) {
  return (
    <Stack.Screen
      options={{
        title,
        headerLargeTitleEnabled: large,
      }}
    />
  );
}
