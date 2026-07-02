import { useState } from "react";
import { Leaf } from "lucide-react";
import { avatarFor } from "../data/avatars";

type AvatarProps = {
  name: string;
  verified?: boolean;
  size?: number;
  src?: string;
};

export function Avatar({ name, verified, size = 32, src }: AvatarProps) {
  const imgSrc = src ?? avatarFor(name);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      {!failed ? (
        <img
          src={imgSrc}
          alt={name}
          onError={() => setFailed(true)}
          className="w-full h-full rounded-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: "#1c4044",
            color: "#7dd3a3",
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: size * 0.45,
          }}
        >
          {name[0]}
        </div>
      )}
      {verified && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#7dd3a3] flex items-center justify-center ring-1 ring-white"
          style={{ width: Math.max(12, size * 0.42), height: Math.max(12, size * 0.42) }}
        >
          <Leaf size={Math.max(7, size * 0.24)} color="#0f1f22" />
        </div>
      )}
    </div>
  );
}
