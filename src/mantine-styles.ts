// Only the Mantine styles this app uses, instead of the full
// @mantine/core/styles.css (~295 kB → ~140 kB raw). Base files first, then
// each component's dependencies before the component (Select needs Input,
// Popover, Combobox and ScrollArea; Checkbox needs InlineInput and
// CheckboxIndicator; Alert needs CloseButton).
// Adding a Mantine component? Add its stylesheet here too —
// scripts/check-css.mjs (run by `npm run build`) fails the build and names
// the stylesheet if anything the app uses is left unstyled.
import '@mantine/core/styles/baseline.css';
import '@mantine/core/styles/default-css-variables.css';
import '@mantine/core/styles/global.css';

import '@mantine/core/styles/UnstyledButton.css';
import '@mantine/core/styles/VisuallyHidden.css';
import '@mantine/core/styles/Paper.css';
import '@mantine/core/styles/Popover.css';
import '@mantine/core/styles/CloseButton.css';
import '@mantine/core/styles/Group.css';
import '@mantine/core/styles/Overlay.css';
import '@mantine/core/styles/Loader.css';
import '@mantine/core/styles/ScrollArea.css';
import '@mantine/core/styles/Input.css';
import '@mantine/core/styles/InlineInput.css';
import '@mantine/core/styles/CheckboxIndicator.css';
import '@mantine/core/styles/Checkbox.css';
import '@mantine/core/styles/CheckboxCard.css';
import '@mantine/core/styles/ActionIcon.css';
import '@mantine/core/styles/Button.css';
import '@mantine/core/styles/Anchor.css';
import '@mantine/core/styles/Text.css';
import '@mantine/core/styles/Title.css';
import '@mantine/core/styles/Combobox.css';
import '@mantine/core/styles/Affix.css';
import '@mantine/core/styles/Alert.css';
import '@mantine/core/styles/Container.css';
import '@mantine/core/styles/Divider.css';
import '@mantine/core/styles/Fieldset.css';
import '@mantine/core/styles/Grid.css';
import '@mantine/core/styles/SimpleGrid.css';
import '@mantine/core/styles/Stack.css';
import '@mantine/core/styles/Table.css';
import '@mantine/core/styles/Tabs.css';
import '@mantine/core/styles/FloatingIndicator.css';
import '@mantine/core/styles/SegmentedControl.css';
