import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ForwardedRef,
} from "react";

type ActionButtonShape = "pill" | "icon" | "card";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  shape?: ActionButtonShape;
};

function ActionButtonComponent(
  { className, shape = "pill", ...props }: ActionButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
) {
  const shapeClass = shape === "pill" ? "" : ` button-control--${shape}`;

  return (
    <button
      ref={ref}
      className={`button-control${shapeClass}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}

export const ActionButton = forwardRef(ActionButtonComponent);
ActionButton.displayName = "ActionButton";
