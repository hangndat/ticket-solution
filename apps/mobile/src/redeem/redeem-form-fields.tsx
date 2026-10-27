import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/theme/colors';
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';
import type {
  FormAnswerValue,
  FormDefinition,
  FormFieldDefinition,
} from './contract.ts';

type Props = {
  form: FormDefinition | null;
  termsVersion: string | null;
  termsBody: string | null;
  answers: Record<string, FormAnswerValue>;
  termsAccepted: boolean;
  disabled?: boolean;
  onChangeAnswer: (fieldId: string, value: FormAnswerValue) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  fieldErrors?: Record<string, string>;
};

/**
 * Native five-field form + terms consent (C-F).
 * Dynamic Type: no maxFontSizeMultiplier cap. VoiceOver via native Switch labels.
 */
export function RedeemFormFields({
  form,
  termsVersion,
  termsBody,
  answers,
  termsAccepted,
  disabled,
  onChangeAnswer,
  onTermsAcceptedChange,
  fieldErrors
}: Props) {
  return (
    <View style={styles.stack}>
      {form && form.fields.length > 0 ? (
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={{ ...typography.sectionTitle, color: colors.label }}
          >
            Required details
          </Text>
          <Text style={{ ...typography.subhead, color: colors.secondary }}>
            Form version {form.formVersion}. Server validates answers.
          </Text>
          {form.fields.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={answers[field.id]}
              error={fieldErrors?.[field.id]}
              disabled={disabled}
              onChange={(value) => onChangeAnswer(field.id, value)}
            />
          ))}
        </View>
      ) : null}

      {termsVersion ? (
        <View style={styles.termsBlock}>
          <Text
            accessibilityRole="header"
            style={{ ...typography.sectionTitle, color: colors.label }}
          >
            Terms
          </Text>
          <Text selectable style={{ ...typography.subhead, color: colors.secondary }}>
            Version {termsVersion}
          </Text>
          {termsBody ? (
            <Text
              selectable
              style={{ ...typography.callout, color: colors.label,  lineHeight: 24 }}
            >
              {termsBody}
            </Text>
          ) : null}
          <View style={styles.switchRow}>
            <Text
              style={{ ...typography.callout, color: colors.label, flex: 1 }}
            >
              Tôi đồng ý điều khoản đã công bố
            </Text>
            <Switch
              value={termsAccepted}
              disabled={disabled}
              onValueChange={onTermsAcceptedChange}
              accessibilityLabel="Tôi đồng ý điều khoản đã công bố"
            />
          </View>
          {fieldErrors?.terms ? (
            <Text
              accessibilityRole="alert"
              style={{ ...typography.subhead, color: colors.destructive }}
            >
              {fieldErrors.terms}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FieldControl({
  field,
  value,
  error,
  disabled,
  onChange
}: {
  field: FormFieldDefinition;
  value: FormAnswerValue | undefined;
  error?: string;
  disabled?: boolean;
  onChange: (value: FormAnswerValue) => void;
}) {
  const label = `${field.label}${field.required ? ' (required)' : ''}`;

  if (field.type === 'checkbox') {
    const checked = value === true;
    return (
      <View style={{ gap: space.sm }}>
        <View style={styles.switchRow}>
          <Text
            style={{ ...typography.callout, color: colors.label, flex: 1 }}
          >
            {label}
          </Text>
          <Switch
            value={checked}
            disabled={disabled}
            onValueChange={(next) => onChange(next)}
            accessibilityLabel={label}
          />
        </View>
        {error ? <ErrorText message={error} /> : null}
      </View>
    );
  }

  if (field.type === 'select') {
    const selected = typeof value === 'string' ? value : '';
    return (
      <View style={styles.selectBlock}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.selectOptions}>
          {(field.options ?? []).map((opt) => {
            const active = selected === opt.id;
            return (
              <Button
                key={opt.id}
                label={opt.label}
                variant={active ? 'primary' : 'secondary'}
                size="lg"
                accessibilityLabel={`${field.label}: ${opt.label}`}
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() => onChange(opt.id)}
                style={styles.selectOption}
              />
            );
          })}
        </View>
        {error ? <ErrorText message={error} /> : null}
      </View>
    );
  }

  const keyboardType =
    field.type === 'email'
      ? 'email-address'
      : field.type === 'phone'
        ? 'phone-pad'
        : 'default';

  return (
    <Input
      label={label}
      accessibilityLabel={label}
      value={typeof value === 'string' ? value : ''}
      onChangeText={(text) => onChange(text)}
      editable={!disabled}
      autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
      autoCorrect={field.type !== 'email' && field.type !== 'phone'}
      keyboardType={keyboardType}
      placeholder={field.label}
      error={error}
    />
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={{ ...typography.subhead, color: colors.destructive }}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  section: { gap: space.md },
  termsBlock: { gap: space.sm + 2 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 44
  },
  selectBlock: { gap: space.sm },
  selectOptions: { gap: space.sm },
  selectOption: { alignSelf: 'stretch' },
  fieldLabel: { ...typography.body, color: colors.label }
});
