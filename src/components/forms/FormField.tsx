import { Ionicons } from "@expo/vector-icons";
import { useFormikContext } from "formik";
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import FormErrorMessage from "@/src/components/forms/FormErrorMessage";
import { colors, type } from "@/src/theme/colors";

type FormValues = Record<string, string>;

type FormFieldProps = {
  name: string;
  label?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPress?: () => void;
  iconAriaLabel?: string;
} & Omit<TextInputProps, "onChangeText" | "value">;

export default function FormField({
  name,
  label,
  placeholder,
  keyboardType,
  icon,
  iconPress,
  iconAriaLabel,
  ...otherProps
}: FormFieldProps) {
  const { errors, setFieldTouched, touched, values, setFieldValue } =
    useFormikContext<FormValues>();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={values[name]}
          onChangeText={(value) => setFieldValue(name, value)}
          onBlur={() => setFieldTouched(name)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          style={styles.input}
          {...otherProps}
        />
        {icon ? (
          <Pressable
            onPress={iconPress}
            accessibilityRole="button"
            accessibilityLabel={iconAriaLabel}
            hitSlop={10}
          >
            <Ionicons name={icon} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <FormErrorMessage error={errors[name]} visible={!!touched[name]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 5,
  },
  label: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 15,
    paddingVertical: 10,
  },
});
