type MatchboardLogoProps = {
  className?: string;
  ariaHidden?: boolean;
};

export function MatchboardLogo({ className, ariaHidden }: MatchboardLogoProps) {
  return (
    <span
      className={[
        "inline-block shrink-0 bg-current",
        "[mask-image:url('/brand/logo.svg')]",
        "[mask-position:center]",
        "[mask-repeat:no-repeat]",
        "[mask-size:contain]",
        className,
      ].filter(Boolean).join(" ")}
      aria-hidden={ariaHidden}
    />
  );
}