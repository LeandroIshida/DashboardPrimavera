// src/components/InfoBtn.js
import React, { useState, useRef } from "react";

function InfoBtn({ tip, children = "i", ...rest }) {
  const [pos, setPos] = useState("right"); // right | left | top | bottom
  const ref = useRef(null);

  const onEnter = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;

    if (vw <= 640) {
      setPos("bottom");
      return;
    }

    const tipWidth = 260;
    const margin = 12;
    if (rect.right + margin + tipWidth > vw) setPos("left");
    else setPos("right");
  };

  // junta className passado com o padrão
  const mergedClass = ["info-btn", rest.className].filter(Boolean).join(" ");

  return (
    <span
      ref={ref}
      {...rest}                 // permite data-*, aria-*, onClick etc.
      className={mergedClass}
      data-tip={tip}            // tip é a fonte da tooltip
      data-pos={pos}
      onMouseEnter={onEnter}
    >
      {children}
    </span>
  );
}

export default InfoBtn;
