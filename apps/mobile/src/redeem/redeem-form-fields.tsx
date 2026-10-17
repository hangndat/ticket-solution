import { Host, Switch } from '@expo/ui';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/theme/colors';
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
  fieldErrors,
}: Props) {
  return (
    <View style={{ gap: 16 }}>
      {form && form.fields.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.label, fontSize: 20, fontWeight: '600' }}
          >
            Required details
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 15 }}>
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
        <View style={{ gap: 10 }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.label, fontSize: 20, fontWeight: '600' }}
          >
            Terms
          </Text>
          <Text selectable style={{ color: colors.secondary, fontSize: 15 }}>
            Version {termsVersion}
          </Text>
          {termsBody ? (
            <Text
              selectable
              style={{ color: colors.label, fontSize: 16, lineHeight: 24 }}
            >
              {termsBody}
            </Text>
          ) : null}
          <Host matchContents>
            <Switch
              label="I accept these published terms"
              value={termsAccepted}
              disabled={disabled}
              onValueChange={onTermsAcceptedChange}
            />
          </Host>
          {fieldErrors?.terms ? (
            <Text
              accessibilityRole="alert"
              style={{ color: '#B00020', fontSize: 15 }}
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
  onChange,
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
      <View style={{ gap: 6 }}>
        <Host matchContents>
          <Switch
            label={label}
            value={checked}
            disabled={disabled}
            onValueChange={(next) => onChange(next)}
          />
        </Host>
        {error ? <ErrorText message={error} /> : null}
      </View>
    );
  }

  if (field.type === 'select') {
    const selected = typeof value === 'string' ? value : '';
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.label, fontSize: 17 }}>{label}</Text>
        <View style={{ gap: 8 }}>
          {(field.options ?? []).map((opt) => {
            const active = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="button"
                accessibilityLabel={`${field.label}: ${opt.label}`}
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() => onChange(opt.id)}
                style={{
                  minHeight: 48,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: active ? colors.accent : colors.card,
                }}
              >
                <Text
                  style={{
                    color: active ? '#fff' : colors.label,
                    fontSize: 17,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
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
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.label, fontSize: 17 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={typeof value === 'string' ? value : ''}
        onChangeText={(text) => onChange(text)}
        editable={!disabled}
        autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
        autoCorrect={field.type !== 'email' && field.type !== 'phone'}
        keyboardType={keyboardType}
        placeholder={field.label}
        style={fieldStyle}
      />
      {error ? <ErrorText message={error} /> : null}
    </View>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={{ color: '#B00020', fontSize: 15 }}>
      {message}
    </Text>
  );
}

const fieldStyle = {
  minHeight: 48,
  padding: 12,
  borderRadius: 12,
  backgroundColor: colors.card,
  color: colors.label,
  fontSize: 17,
};
