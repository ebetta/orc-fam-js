import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast(); // Adicionado dismiss

  return (
    <ToastProvider> {/* Removed duration={5000} */}
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Remove duration and open from individual toast props
        // Let Radix ToastProvider control open state based on its duration
        // and presence/absence in the toasts array.
        const { duration, open, ...restProps } = props;
        return (
          // Pass open state from Radix using a render prop or context if needed,
          // but for now, let's see if Radix handles it by not passing `open`
          <Toast key={id} {...restProps}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} /> {/* Adicionado onClick */}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 