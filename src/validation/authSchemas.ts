import * as Yup from "yup";

export type LoginFormValues = {
  emailOrUsername: string;
  password: string;
};

export const LoginValidationSchema: Yup.ObjectSchema<LoginFormValues> =
  Yup.object({
    emailOrUsername: Yup.string()
      .trim()
      .required("Email or username is required"),
    password: Yup.string().required("Password is required"),
  });

export type SignupFormValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const SignupValidationSchema: Yup.ObjectSchema<SignupFormValues> =
  Yup.object({
    username: Yup.string()
      .trim()
      .required("Username is required")
      .min(3, "Username must be at least 3 characters"),
    email: Yup.string()
      .trim()
      .required("Email is required")
      .email("Please enter a valid email"),
    password: Yup.string()
      .required("Password is required")
      .min(8, "Password must be at least 8 characters")
      .matches(/[a-z]/, "Password must include a lowercase letter")
      .matches(/[A-Z]/, "Password must include an uppercase letter")
      .matches(/[0-9]/, "Password must include a number")
      .matches(/[^A-Za-z0-9]/, "Password must include a symbol"),
    confirmPassword: Yup.string()
      .required("Please confirm your password")
      .oneOf([Yup.ref("password")], "Passwords must match"),
  });
