import type { UserRole } from "@/types";

export type AuthMode = "login" | "signup";

export type AuthField =
  | "email"
  | "firstName"
  | "lastName"
  | "mobile"
  | "restaurantName"
  | "restaurantPhone"
  | "restaurantDescription";

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export interface AuthFormValues {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  restaurantName: string;
  restaurantPhone: string;
  restaurantDescription: string;
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validMobile(value: string) {
  return /^[6-9]\d{9}$/.test(value.trim());
}

export function validateAuthForm(values: AuthFormValues, role: UserRole, mode: AuthMode): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!validEmail(values.email)) errors.email = "Enter a valid email address.";

  if (mode === "signup" && role !== "PLATFORM_ADMIN") {
    if (!values.firstName.trim()) errors.firstName = "First name is required.";
    if (!values.lastName.trim()) errors.lastName = "Last name is required.";
    if (!values.mobile.trim()) errors.mobile = "Mobile number is required.";
    else if (!validMobile(values.mobile)) errors.mobile = "Enter a valid 10 digit mobile number.";
  }

  if (mode === "signup" && role === "RESTAURANT_ADMIN") {
    if (!values.restaurantName.trim()) errors.restaurantName = "Restaurant name is required.";
    if (!values.restaurantPhone.trim()) errors.restaurantPhone = "Restaurant contact number is required.";
    else if (!validMobile(values.restaurantPhone)) errors.restaurantPhone = "Enter a valid 10 digit restaurant contact number.";
    if (!values.restaurantDescription.trim()) errors.restaurantDescription = "Restaurant description is required.";
  }

  return errors;
}

export function firstAuthErrorField(errors: AuthFieldErrors): AuthField | null {
  const order: AuthField[] = ["email", "firstName", "lastName", "mobile", "restaurantName", "restaurantPhone", "restaurantDescription"];
  return order.find((field) => errors[field]) ?? null;
}
