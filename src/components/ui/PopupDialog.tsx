"use client";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  confirmText?: string;
};

export default function PopupDialog({
  open,
  title,
  message,
  onClose,
  confirmText = "OK",
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-[2000]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className="bg-[var(--card)] text-[var(--text)] border border-[var(--divider)] rounded-xl shadow-2xl max-w-sm w-[90%] p-6 text-center"
          >
            <h3 className="text-lg font-bold mb-3">{title}</h3>
            {message && (
              <p className="text-[var(--muted)] text-sm mb-5">{message}</p>
            )}
            <button
              onClick={onClose}
              className="bg-[var(--accent)] text-[var(--accent-foreground)] font-bold py-2 px-5 rounded-lg hover:opacity-90"
            >
              {confirmText}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
