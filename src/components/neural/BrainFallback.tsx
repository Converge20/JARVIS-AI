import { memo } from "react";
import type { NeuralMode } from "./activity";
/** Pre-render of the same licensed anatomical composite. No procedural stand-in or GPU loop. */
export const BrainFallback = memo(function BrainFallback({
  anatomyView = false,
}: {
  mode: NeuralMode;
  variant: number;
  anatomyView?: boolean;
}) {
  return (
    <img
      className="brain-fallback"
      src={
        anatomyView
          ? "/models/brain-anatomy-preview.png"
          : "/models/brain-hologram-preview.png"
      }
      alt="Anatomical brain composite with folded cerebral hemispheres, a cerebellum and brainstem"
    />
  );
});
