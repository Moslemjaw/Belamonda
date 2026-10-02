import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render errors so one broken component doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6" dir={ar() ? "rtl" : "ltr"}>
        <div className="bg-white rounded-3xl shadow-sm border border-surface-100 p-8 max-w-md w-full text-center">
          <div className="text-lg font-bold text-surface-900">
            {ar() ? "حدث خطأ غير متوقع" : "Something went wrong"}
          </div>
          <div className="mt-2 text-sm text-surface-600">
            {ar() ? "يرجى إعادة تحميل الصفحة. إذا استمرت المشكلة، تواصل مع الدعم." : "Please reload the page. If the problem continues, contact support."}
          </div>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              className="px-5 py-2.5 rounded-xl bg-brand-pink-600 text-white text-sm font-bold hover:bg-brand-pink-700"
              onClick={() => window.location.reload()}
            >
              {ar() ? "إعادة التحميل" : "Reload"}
            </button>
            <button
              className="px-5 py-2.5 rounded-xl border border-surface-200 text-surface-700 text-sm font-bold hover:bg-surface-50"
              onClick={() => this.setState({ error: null })}
            >
              {ar() ? "المحاولة مجددًا" : "Try again"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
