import { useFormikContext } from "formik";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, type } from "@/src/theme/colors";

type FormSubmitButtonProps = {
  title: string;
  disabled?: boolean;
};

export default function FormSubmitButton({
  title,
  disabled,
}: FormSubmitButtonProps) {
  const { handleSubmit } = useFormikContext();
  return (
    <Pressable
      onPress={() => handleSubmit()}
      style={[styles.button, disabled && styles.buttonDisabled]}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "700",
  },
});
