import { useState, useRef, useEffect } from "react";
import { useFormik, FormikErrors } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { toast } from "react-hot-toast";

interface KycFormValues {
  number: string;
  ghanaCardFront: File | null;
  ghanaCardBack: File | null;
  momo: {
    country_code: string;
    number: string;
  };
  selfie: File | null;
}

const KYC_STEPS = [
  "Ghana Card",
  "MoMo Verification",
  "Selfie Upload",
];

const initialValues: KycFormValues = {
  number: "",
  ghanaCardFront: null,
  ghanaCardBack: null,
  momo: {
    country_code: "+233",
    number: "",
  },
  selfie: null,
};

const validationSchema = [
  // Step 1: Ghana Card
  Yup.object({
    number: Yup.string()
      .required("Ghana Card Number is required")
      .matches(/^GHA-\d{9}-\d$/, "Invalid Ghana Card Number format"),
    ghanaCardFront: Yup.mixed().required("Front image is required"),
    ghanaCardBack: Yup.mixed().required("Back image is required"),
  }),
  // Step 2: MoMo
  Yup.object({
    momo: Yup.object({
      country_code: Yup.string().required("Country code is required"),
      number: Yup.string()
        .matches(/^[0-9]{6,15}$/, "Invalid phone number")
        .required("Phone number is required"),
    }),
  }),
  // Step 3: Selfie
  Yup.object({
    selfie: Yup.mixed().required("Selfie is required"),
  }),
];

// Color theme
const PRIMARY = "#a52c3f";
const PRIMARY_DARK = "#7d1f2e";
const PRIMARY_LIGHT = "#fbeaec";
const PRIMARY_RING = "#green";
const PRIMARY_TEXT = "#a52c3f";
const SECONDARY = "#fbeaec";
const BORDER = "#a52c3f";
const ERROR = "#d32f2f";
const SUCCESS = "#388e3c";
const TEXT_COLOR = "#313131";
const BORDER_GREY = "#494848";

// Helper for persistent file preview URLs
function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return preview;
}

function FileInputWithPreview({
  label,
  name,
  value,
  onChange,
  error,
  capture,
}: {
  label: string;
  name: string;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string | false;
  capture?: 'user' | 'environment';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useFilePreview(value);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    onChange(file);
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <label className="block font-medium mb-1 w-full text-left text-gray-600">{label}</label>
      <button
        type="button"
        className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-32 transition-colors focus:outline-none`}
        style={{
          background: preview ? "transparent" : SECONDARY,
          borderColor: error ? ERROR : preview ? SUCCESS : BORDER,
          boxShadow: error ? `0 0 0 2px ${ERROR}` : undefined,
        }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="object-contain h-24 w-auto rounded mb-1"
          />
        ) : (
          <span className="flex flex-col items-center" style={{ color: "#bfa3a8" }}>
            <svg className="w-8 h-8 mb-1" fill="none" stroke={PRIMARY} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12M7 16l-2 2m0 0l2 2m-2-2h16" />
            </svg>
            Click to upload
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/*"
          capture={capture}
          className="hidden"
          onChange={handleFileChange}
        />
      </button>
      {value && (
        <button
          type="button"
          className="text-xs mt-1"
          style={{ color: ERROR, textDecoration: "underline" }}
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Remove
        </button>
      )}
      {error && <div className="text-xs mt-1 w-full text-left" style={{ color: ERROR }}>{error}</div>}
    </div>
  );
}

export default function KycPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ghanaCardVerified, setGhanaCardVerified] = useState(false);
  const [verifyingGhanaCard, setVerifyingGhanaCard] = useState(false);
  const [ghanaCardError, setGhanaCardError] = useState("");
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [fullName, setFullName] = useState("");

  // Persist file previews for summary screen
  const [submittedValues, setSubmittedValues] = useState<KycFormValues | null>(null);

  // For summary screen previews
  const ghanaCardFrontPreview = useFilePreview(submittedValues?.ghanaCardFront ?? null);
  const ghanaCardBackPreview = useFilePreview(submittedValues?.ghanaCardBack ?? null);
  const selfiePreview = useFilePreview(submittedValues?.selfie ?? null);

  const formik = useFormik<KycFormValues>({
    initialValues,
    validationSchema: validationSchema[currentStep],
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values) => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const formData = new FormData();
        formData.append("number", values.number);
        if (values.ghanaCardFront) formData.append("ghanaCardFront", values.ghanaCardFront);
        if (values.ghanaCardBack) formData.append("ghanaCardBack", values.ghanaCardBack);
        formData.append("momo_country_code", values.momo.country_code);
        formData.append("momo_number", values.momo.number);
        if (values.selfie) formData.append("selfie", values.selfie);
        const res = await axios.post("/api/complete-kyc", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setFullName(res?.data?.full_name || "");
        setSuccess(res.data.message || "KYC Completed!");
        setSubmittedValues(values);
        setShowSuccessScreen(true);
        toast.success(res.data.message || "KYC Completed!");
      } catch (err) {
        let message = "Failed to complete KYC";
        if (axios.isAxiosError(err)) {
          message = err.response?.data?.message || err.message || message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
  });

  const handleNext = async () => {
    const errors: FormikErrors<KycFormValues> = await formik.validateForm();
    if (Object.keys(errors).length === 0) {
      // Ghana Card verification before moving to step 2
      if (currentStep === 0 && !ghanaCardVerified) {
        setGhanaCardError("");
        setVerifyingGhanaCard(true);
        try {
          // Replace with your actual endpoint
          const res = await axios.post("/api/verify-ghana-card", {
            number: formik.values.number,
          });
          if (res.data && res.data.verified) {
            setGhanaCardVerified(true);
            setCurrentStep((s) => s + 1);
          } else {
            setGhanaCardError(res.data?.message || "Ghana Card verification failed.");
            toast.error(res.data?.message || "Ghana Card verification failed.");
          }
        } catch (err) {
          let message = "Ghana Card verification failed.";
          if (axios.isAxiosError(err)) {
            message = err.response?.data?.message || err.message || message;
          } else if (err instanceof Error) {
            message = err.message;
          }
          setGhanaCardError(message);
          toast.error(message);
        } finally {
          setVerifyingGhanaCard(false);
        }
        return;
      }
      setCurrentStep((s) => s + 1);
    } else {
      if (currentStep === 0) {
        formik.setTouched({
          number: true,
          ghanaCardFront: true,
          ghanaCardBack: true,
          momo: { country_code: false, number: false },
          selfie: false,
        });
      } else if (currentStep === 1) {
        formik.setTouched({
          number: false,
          ghanaCardFront: false,
          ghanaCardBack: false,
          momo: { country_code: true, number: true },
          selfie: false,
        });
      } else if (currentStep === 2) {
        formik.setTouched({
          number: false,
          ghanaCardFront: false,
          ghanaCardBack: false,
          momo: { country_code: false, number: false },
          selfie: true,
        });
      }
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  // Success screen
  if (showSuccessScreen && submittedValues) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-0 py-0  md:py-8 md:px-2"
        style={{
          background: `linear-gradient(135deg, #fff6f7 0%, #fbeaec 100%)`,
        }}
      >
        <div
          className="w-full max-w-lg max-sm:h-full bg-white shadow-none rounded-none md:rounded-2xl p-6 sm:p-10 pt-3 lg:pt-4 border-0 md:border flex flex-col items-center"
          style={{
            borderColor: BORDER,
          }}
        >
          <img src="/logoform.jpg" alt="logo" className="w-auto h-10 mb-6 text-center mx-auto" />
          <div className="flex flex-col items-center justify-center mt-4 mb-6">
            <div
              className="rounded-full flex items-center justify-center mb-4"
              style={{
                background: SUCCESS,
                width: 72,
                height: 72,
              }}
            >
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="#fff"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.2" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 13l3 3 7-7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: SUCCESS }}>
              KYC Completed!
            </h2>
            <p className="text-center text-gray-700 mb-2">
              Your identity has been successfully verified.
            </p>
            {success && (
              <div className="text-center text-sm mb-2" style={{ color: SUCCESS }}>
                {success}
              </div>
            )}
          </div>
          <div className="w-full max-w-md mx-auto bg-[#f8f8f8] rounded-lg p-4 mb-4 border" style={{ borderColor: "#e0e0e0" }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: PRIMARY }}>
              Your Details
            </h3>
            <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-36">Full Name:</span>
                <span className="text-gray-900">{fullName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-36">Ghana Card Number:</span>
                <span className="text-gray-900">{submittedValues.number}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-36">MoMo Number:</span>
                <span className="text-gray-900">{submittedValues.momo.country_code} {submittedValues.momo.number}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-36">Front Image:</span>
                {ghanaCardFrontPreview ? (
                  <img src={ghanaCardFrontPreview} alt="Front" className="h-12 w-auto rounded border" />
                ) : (
                  <span className="text-gray-400">Not uploaded</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-36">Back Image:</span>
                {ghanaCardBackPreview ? (
                  <img src={ghanaCardBackPreview} alt="Back" className="h-12 w-auto rounded border" />
                ) : (
                  <span className="text-gray-400">Not uploaded</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-36">Selfie:</span>
                {selfiePreview ? (
                  <img src={selfiePreview} alt="Selfie" className="h-12 w-auto rounded-full border" />
                ) : (
                  <span className="text-gray-400">Not uploaded</span>
                )}
              </div>
            </div>
          </div>
          {/* <div className="w-full flex flex-col items-center">
            <a
              href="/"
              className="mt-2 px-6 py-2 rounded font-semibold shadow transition"
              style={{
                background: PRIMARY,
                color: "#fff",
                border: "none",
                boxShadow: `0 2px 8px 0 ${PRIMARY}22`,
                textDecoration: "none",
              }}
            >
              Go to Dashboard
            </a>
          </div> */}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-0 py-0  md:py-8 md:px-2"
      style={{
        background: `linear-gradient(135deg, #fff6f7 0%, #fbeaec 100%)`,
      }}
    >
      <div
        className="w-full max-w-lg max-sm:h-full bg-white shadow-none rounded-none md:rounded-2xl p-6 sm:p-10 pt-3 lg:pt-4 border-0 md:border"
        style={{
          borderColor: BORDER,
          // boxShadow: `0 2px 16px 0 rgba(165,44,63,0.08)`,
        }}
      >
        <img src="/logoform.jpg" alt="logo" className="w-auto h-10 mb-6 text-center mx-auto" />
        <h1
          className="text-2xl font-bold text-center mb-2"
          style={{ color: TEXT_COLOR }}
        >
          Complete KYC Verification
        </h1>
        <p className="text-center mb-6 text-sm text-gray-600">
          Verify your identity to secure your account and authorize transactions.
        </p>
        {/* Stepper with progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            {KYC_STEPS.map((title, idx) => (
              <div key={title} className="flex-1 flex flex-col items-center relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center mb-1 text-white text-base font-semibold transition-all duration-200 shadow"
                  style={{
                    background:
                      idx === currentStep
                        ? PRIMARY
                        : idx < currentStep
                        ? SUCCESS
                        : "#e5e5e5",
                    transform: idx === currentStep ? "scale(1.1)" : undefined,
                  }}
                >
                  {idx < currentStep ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="#fff"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className="text-xs text-center font-medium"
                  style={{
                    color:
                      idx === currentStep
                        ? PRIMARY
                        : idx < currentStep
                        ? SUCCESS
                        : "#bfa3a8",
                  }}
                >
                  {title}
                </span>
                {idx < KYC_STEPS.length - 1 && (
                  <div className="hidden top-4 right-0 w-full h-1 z-0">
                    <div
                      className="h-1 rounded transition-all duration-300"
                      style={{
                        background:
                          idx < currentStep
                            ? `linear-gradient(to right, ${PRIMARY}, ${SUCCESS})`
                            : "#f3e6e8",
                        width: idx < currentStep ? "100%" : "0",
                        transition: "width 0.3s",
                      }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="w-full h-1 rounded mt-2 overflow-hidden" style={{ background: "#f3e6e8" }}>
            <div
              className="h-1 transition-all duration-300"
              style={{
                background: `linear-gradient(to right, ${PRIMARY}, ${SUCCESS})`,
                width: `${((currentStep + 1) / KYC_STEPS.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>
        <form
          onSubmit={formik.handleSubmit}
          encType="multipart/form-data"
          className="space-y-4"
        >
          {currentStep === 0 && (
            <>
              <div className="mb-4">
                <h2
                  className="text-lg font-semibold mb-4 text-center"
                  style={{ color: TEXT_COLOR }}
                >
                  Ghana Card Details
                </h2>
                <label className="block font-medium mb-1 text-gray-600">
                  Ghana Card Number
                </label>
                <input
                  type="text"
                  name="number"
                  className="w-full border rounded px-3 py-2 transition"
                  style={{
                    borderColor: formik.touched.number && formik.errors.number ? ERROR : BORDER_GREY,
                    outline: "none",
                    boxShadow:
                      formik.touched.number && formik.errors.number
                        ? `0 0 0 2px ${ERROR}33`
                        : `0 0 0 2px ${PRIMARY_RING}22`,
                  }}
                  placeholder="GHA-000000000-0"
                  value={formik.values.number}
                  onChange={e => {
                    formik.handleChange(e);
                    setGhanaCardVerified(false); // Reset verification if number changes
                    setGhanaCardError("");
                  }}
                />
                {formik.touched.number && formik.errors.number && (
                  <div className="text-xs mt-1" style={{ color: ERROR }}>
                    {formik.errors.number}
                  </div>
                )}
                {ghanaCardError && (
                  <div className="text-xs mt-1" style={{ color: ERROR }}>
                    {ghanaCardError}
                  </div>
                )}
                {ghanaCardVerified && (
                  <div className="text-xs mt-1" style={{ color: SUCCESS }}>
                    Ghana Card verified!
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <FileInputWithPreview
                  label="Front Image"
                  name="ghanaCardFront"
                  value={formik.values.ghanaCardFront}
                  onChange={(file) => formik.setFieldValue("ghanaCardFront", file)}
                  error={formik.touched.ghanaCardFront && formik.errors.ghanaCardFront}
                  capture="environment"
                />
                <FileInputWithPreview
                  label="Back Image"
                  name="ghanaCardBack"
                  value={formik.values.ghanaCardBack}
                  onChange={(file) => formik.setFieldValue("ghanaCardBack", file)}
                  error={formik.touched.ghanaCardBack && formik.errors.ghanaCardBack}
                  capture="environment"
                />
              </div>
            </>
          )}
          {currentStep === 1 && (
            <>
              <div className="mb-4">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{ color: TEXT_COLOR }}
                >
                  Mobile Money Verification
                </h2>
                <label className="block font-medium mb-1 text-gray-600">
                  Mobile Money Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="momo.country_code"
                    className="w-20 border rounded px-2 py-2 transition"
                    style={{
                      borderColor: BORDER_GREY,
                      color: TEXT_COLOR,
                      background: "#fff",
                    }}
                    value={formik.values.momo.country_code}
                    onChange={formik.handleChange}
                    readOnly
                  />
                  <input
                    type="text"
                    name="momo.number"
                    className="flex-1 border rounded px-3 py-2 transition"
                    style={{
                      borderColor:
                        formik.touched.momo?.number && formik.errors.momo?.number
                          ? ERROR
                          : BORDER_GREY,
                      outline: "none",
                      boxShadow:
                        formik.touched.momo?.number && formik.errors.momo?.number
                          ? `0 0 0 2px ${ERROR}33`
                          : `0 0 0 2px ${PRIMARY_RING}22`,
                    }}
                    placeholder="Enter number"
                    value={formik.values.momo.number}
                    onChange={formik.handleChange}
                  />
                </div>
                {formik.touched.momo?.number && formik.errors.momo?.number && (
                  <div className="text-xs mt-1" style={{ color: ERROR }}>
                    {formik.errors.momo.number}
                  </div>
                )}
              </div>
              <div
                className="rounded p-3 text-xs mt-2"
                style={{
                  background: PRIMARY_LIGHT,
                  border: `1px solid ${PRIMARY}`,
                  color: PRIMARY,
                }}
              >
                The name on your Mobile Money account must exactly match the name on your Ghana Card.
              </div>
            </>
          )}
          {currentStep === 2 && (
            <>
              <div className="mb-4">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{ color: TEXT_COLOR }}
                >
                  Upload a Selfie
                </h2>
                <FileInputWithPreview
                  label="Selfie"
                  name="selfie"
                  value={formik.values.selfie}
                  onChange={(file) => formik.setFieldValue("selfie", file)}
                  error={formik.touched.selfie && formik.errors.selfie}
                  capture="user"
                />
              </div>
              <div
                className="rounded p-3 text-xs mt-2"
                style={{
                  background: PRIMARY_LIGHT,
                  border: `1px solid ${PRIMARY}`,
                  color: PRIMARY,
                }}
              >
                Please ensure your face is clearly visible and well-lit. On mobile, your camera will open automatically.
              </div>
            </>
          )}
          {/* Errors and success messages are now shown via toast notifications. */}
          <div className="flex justify-between mt-6 gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                className="px-4 py-2 cursor-pointer rounded border transition"
                style={{
                  background: "#fff",
                  color: PRIMARY_TEXT,
                  borderColor: BORDER,
                  fontWeight: 500,
                }}
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </button>
            )}
            {currentStep < KYC_STEPS.length - 1 && (
              <button
                type="button"
                className="px-4 py-2 cursor-pointer rounded w-full font-semibold shadow flex items-center justify-center min-w-[120px] transition"
                style={{
                  background: PRIMARY,
                  color: "#fff",
                  border: "none",
                  boxShadow: `0 2px 8px 0 ${PRIMARY}22`,
                }}
                onClick={handleNext}
                disabled={loading || verifyingGhanaCard}
              >
                {verifyingGhanaCard ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="#fff" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Verifying...
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            )}
            {currentStep === KYC_STEPS.length - 1 && (
              <button
                type="submit"
                className="px-4 py-2 w-full rounded font-semibold shadow transition"
                style={{
                  background: PRIMARY_DARK,
                  color: "#fff",
                  border: "none",
                  boxShadow: `0 2px 8px 0 ${PRIMARY_DARK}22`,
                }}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Complete Verification"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
