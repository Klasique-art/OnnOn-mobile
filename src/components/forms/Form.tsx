import { ReactNode } from "react";
import {
  Formik,
  FormikConfig,
  FormikHelpers,
  FormikValues,
} from "formik";

type AppFormProps<T extends FormikValues> = {
  children: ReactNode;
  initialValues: T;
  validationSchema?: FormikConfig<T>["validationSchema"];
  onSubmit: (values: T, helpers: FormikHelpers<T>) => void | Promise<void>;
};

export default function AppForm<T extends FormikValues>({
  children,
  initialValues,
  validationSchema,
  onSubmit,
}: AppFormProps<T>) {
  return (
    <Formik<T>
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
    >
      {() => children}
    </Formik>
  );
}
