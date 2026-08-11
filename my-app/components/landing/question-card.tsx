"use client";

import { useState } from "react";
import Image from "next/image";

import styles from "./question-card.module.css";

type QuestionIllustration = "scope" | "documents" | "team";

export function LandingQuestionCard({
  title,
  description,
  illustration,
}: {
  title: string;
  description: string;
  illustration: QuestionIllustration;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <article
      className={`${styles.card} relative h-60 w-full max-w-[490px] rounded-lg bg-linear-47 from-[#1C1C1C] to-[#050505] outline outline-[1.50px] outline-offset-[-1.50px] outline-[#2B2B2B]`}
      data-hovered={isHovered}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <QuestionIllustration variant={illustration} />

      <div className="absolute inset-x-1 top-[104px] flex h-28 flex-col items-center justify-center px-6 text-center text-stone-50">
        <h3 className="text-xl font-bold leading-[1.35]">{title}</h3>
        <p className="mt-3 text-lg font-normal leading-8">{description}</p>
      </div>
    </article>
  );
}

function QuestionIllustration({ variant }: { variant: QuestionIllustration }) {
  if (variant === "scope") return <ScopeQuestionIllustration />;
  if (variant === "documents") return <DocumentsQuestionIllustration />;
  return <TeamQuestionIllustration />;
}

function ScopeQuestionIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="110 0 250 176"
      fill="none"
      className={`${styles.illustration} ${styles.centeredIllustration} ${styles.scope} absolute -top-[108px] left-1/2 h-44 w-[250px] origin-center`}
    >
      <path
        d="M321.07 44.7441H134.175C129.967 44.7441 126.625 48.0866 126.625 52.2955V167.423H328.62V52.2955C328.62 48.0866 325.154 44.7441 321.07 44.7441Z"
        fill="#323648"
      />
      <path d="M320.205 53.0391H134.795V159.13H320.205V53.0391Z" fill="#EEEEEE" />
      <rect x="146.053" y="63.4355" width="164.749" height="4.12157" rx="2.06079" fill="#D1D1D1" />
      <rect x="147.25" y="77.5996" width="95.889" height="4.12157" rx="2.06079" fill="#3F3F47" />
      <rect x="146.053" y="91.7637" width="125.047" height="4.12157" rx="2.06079" fill="#D1D1D1" />
      <rect x="146.053" y="105.928" width="164.749" height="4.12157" rx="2.06079" fill="#3F3F47" />
      <rect x="145.6" y="119.738" width="164.932" height="4.12157" rx="2.06079" fill="#D1D1D1" />
      <rect x="145.6" y="134.85" width="164.932" height="4.12157" rx="2.06079" fill="#D1D1D1" />
      <path
        d="M114 160.285V167.679C114 171.503 118.456 174.563 124.025 174.563H331.219C336.789 174.563 341.244 171.503 341.244 167.679V160.285H114Z"
        fill="#002EEF"
      />
      <path
        d="M305.952 0.0827C293.284 10.0207 275.734 17.8291 256.435 22.0846L256.245 58.4911C256.158 75.149 263.898 90.2198 279.251 103.285C289.339 111.869 299.945 117.194 305.327 119.586C305.558 119.488 305.813 119.371 306.063 119.262V0.1664C306.026 0.1409 305.988 0.1119 305.952 0.0827Z"
        fill="#002EEF"
        fillOpacity="0.64"
      />
      <path
        d="M306.146 0.0819V119.738C311.742 117.237 321.912 112.069 331.651 103.887C347.136 90.8776 355.032 75.798 355.119 59.0616L355.309 22.4837C336.115 18.0728 318.698 10.1216 306.146 0.0819Z"
        transform="translate(-1 0)"
        fill="#002EEF"
        fillOpacity="0.64"
      />
      <path
        d="M306.453 0.0005C287.706 8.1622 278.024 11.109 259.981 15.2739V57.1651C259.9 73.4683 267.136 88.2181 281.49 101.005C290.921 109.406 300.837 114.618 305.869 116.959C306.085 116.863 306.323 116.749 306.557 116.642V0.0824C306.522 0.0574 306.486 0.029 306.453 0.0005Z"
        fill="#002BFF"
      />
      <path
        d="M306.557 0.0811V116.641C311.789 114.204 321.299 109.17 330.407 101.2C344.887 88.5268 352.271 73.8375 352.351 57.5343V14.0357C334.087 10.3252 315.071 3.9865 306.557 0.0811Z"
        transform="translate(-1 0)"
        fill="#002EEF"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M291.653 52.8887V46.9289C291.653 42.9772 293.223 39.1875 296.017 36.3933C298.811 33.5991 302.601 32.0293 306.553 32.0293C310.504 32.0293 314.294 33.5991 317.088 36.3933C319.883 39.1875 321.452 42.9772 321.452 46.9289V52.8887C323.033 52.8887 324.549 53.5166 325.667 54.6343C326.784 55.752 327.412 57.2679 327.412 58.8485V73.7481C327.412 75.3287 326.784 76.8446 325.667 77.9623C324.549 79.08 323.033 79.7079 321.452 79.7079H291.653C290.073 79.7079 288.557 79.08 287.439 77.9623C286.321 76.8446 285.693 75.3287 285.693 73.7481V58.8485C285.693 57.2679 286.321 55.752 287.439 54.6343C288.557 53.5166 290.073 52.8887 291.653 52.8887ZM315.492 46.9289V52.8887H297.613V46.9289C297.613 44.5579 298.555 42.284 300.231 40.6075C301.908 38.931 304.182 37.9891 306.553 37.9891C308.924 37.9891 311.198 38.931 312.874 40.6075C314.551 42.284 315.492 44.5579 315.492 46.9289Z"
        fill="white"
      />
    </svg>
  );
}

function DocumentsQuestionIllustration() {
  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-0 h-px w-[490px] -translate-x-1/2"
    >
      <Image
        src="/images/landing/question-document-left.svg"
        alt=""
        width={82}
        height={115}
        className={`${styles.documentLeft} absolute left-[156px] top-[-35.11px] z-10 h-[115px] w-[82px] drop-shadow-[0_12px_18px_rgba(0,43,255,0.16)]`}
      />
      <Image
        src="/images/landing/question-document-right.svg"
        alt=""
        width={82}
        height={115}
        className={`${styles.documentRight} absolute left-[252.57px] top-[-47.33px] z-10 h-[115px] w-[82px] drop-shadow-[0_12px_18px_rgba(0,43,255,0.16)]`}
      />
      <Image
        src="/images/landing/question-document-center.svg"
        alt=""
        width={82}
        height={115}
        className={`${styles.documentCenter} absolute left-[196.52px] top-[-79px] z-20 h-[115px] w-[82px] drop-shadow-[0_16px_22px_rgba(0,43,255,0.24)]`}
      />
    </div>
  );
}

function TeamQuestionIllustration() {
  return (
    <Image
      aria-hidden="true"
      src="/images/landing/question-team-hands.svg"
      alt=""
      width={200}
      height={150}
      className={`${styles.illustration} ${styles.centeredIllustration} ${styles.team} absolute -top-[91px] left-1/2 h-[150px] w-[200px] origin-center drop-shadow-[0_16px_28px_rgba(0,43,255,0.22)]`}
    />
  );
}
