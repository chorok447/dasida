import Link from "next/link";
import { Avatar } from "@/components/avatar";

export function AuthorHeader({
  name,
  verified,
  profileImageUrl,
  authorId,
  avatarSize,
  time,
  timeClassName = "text-[12px] opacity-60",
  className = "",
}: {
  name: string;
  verified: boolean;
  profileImageUrl?: string | null;
  authorId?: number | null;
  avatarSize?: number;
  time?: string;
  timeClassName?: string;
  className?: string;
}) {
  const inner = (
    <>
      <Avatar name={name} verified={verified} size={avatarSize} src={profileImageUrl ?? undefined} />
      <div>
        <div style={{ color: "var(--foreground)" }}>{name}</div>
        {time ? (
          <div className={timeClassName} style={{ color: "var(--foreground)" }}>
            {time}
          </div>
        ) : null}
      </div>
    </>
  );
  const classNames = `flex items-center gap-3 min-w-0 ${className}`.trim();
  if (authorId) {
    return (
      <Link href={`/users/${authorId}`} className={`${classNames} transition-opacity hover:opacity-90`}>
        {inner}
      </Link>
    );
  }
  return <div className={classNames}>{inner}</div>;
}
