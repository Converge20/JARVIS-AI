# Anatomical visual correction — review evidence

The earlier brain was a deformed ellipsoid with added sine-wave grooves and tube gyri. It retained an oval/football envelope, even when many lines and nodes were added. Its mirrored hemispheres also lacked genuine subject-level asymmetry. That geometry generator and its procedural fallback have been removed.

## Neutral geometry comparison

Inspect [the dashboard with all effects disabled](axiom-anatomy.jpg), [the neutral side view](axiom-anatomy-side.jpg), [the frontal fissure view](axiom-anatomy-front.jpg), and [the corrected holographic dashboard](axiom-desktop.jpg).

The new cerebral cortex is the actual MRI-derived bilateral pial surface from OpenNeuro ds006128, subject sub-01 (snapshot 1.0.11), via the pinned anatomical atlas documented in [the model attribution](../public/models/ATTRIBUTION.md). The Full-detail cortex retains the source's 150,256 triangles, natural left/right variation, gyri, sulci, and medial fissure. It is only recentered and uniformly scaled. It is not a new procedural approximation.

The cortex was visually compared in side and three-quarter views against an **unmodified neutral render of that real MRI-derived reference surface**. Cerebellum and brainstem placement/shape were compared against a separate **unmodified BodyParts3D reference render**. These reference renders are included as [MRI reference](anatomy-reference-cortex.jpg) and [BodyParts3D reference](anatomy-reference-atlas.jpg). These are real anatomical data sources, not generated illustrations.

| Feature           | Reference and result                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cortical envelope | The native pial lobe contours are retained. The frontal/temporal boundaries and inferior recesses no longer follow an ellipsoid.                                                                                                                                |
| Gyri/sulci        | Deep irregular folds exist in geometry and remain legible under neutral white lighting with nodes, pathways, glow, bloom, and transparency disabled.                                                                                                            |
| Hemispheres       | The native MRI left/right surfaces are retained rather than mirroring one synthetic shape. Unit checks verify bilateral vertices and non-identical reflected surfaces. Front inspection by rotation exposes the medial fissure.                                 |
| Cerebellum        | A separate licensed BodyParts3D cerebellum sits beneath the posterior cortex. It is a real atlas mesh, not a rippled sphere.                                                                                                                                    |
| Brainstem         | Separate atlas midbrain, pons, and medulla meshes replace the previous tube. The lower structure remains visible in the neutral side/three-quarter views.                                                                                                       |
| Signal placement  | Every node is a cortical vertex plus a small normal offset. Each route step follows an actual edge of that LOD mesh; interpolation is linear along those edges rather than a spline that cuts through grooves. Automated tests check all nodes and route edges. |

For an additional independently authored human specimen reference, reviewers can consult [John A. Beal's lateral-view photograph](https://commons.wikimedia.org/wiki/File:Human_brain_lateral_view_cut-line_brainstem.JPG), Louisiana State University Health Sciences Center Shreveport (CC BY 2.5). That photograph is linked for review and is not bundled or used as a texture.

## Repeatable inspection

1. Run `npm ci` and `npm run dev`, then open http://localhost:5173.
2. Select **Anatomy · effects off**. This removes all node/packet/path layers, bloom, rim emission, blue materials, and transparency; it uses opaque gray anatomy with neutral lighting.
3. Rotate by dragging or using the left/right buttons. Check the side silhouette, midline, true folds, cerebellum, and stem. Reset returns to the initial three-quarter view.
4. Toggle the control off to restore the blue holographic treatment. Select each of the six neural states, then the five scenario previews.
5. Compare Full detail, Eco, and Static. Static is a pre-render of the same composite, not the previous procedural SVG.
6. Verify task creation/editing/completion/deletion across reloads, chat, navigation, and activity as normal.

## Source and visual limits

The cortex (CC0) and lower structures (BodyParts3D, CC BY 4.0) come from different datasets. Their alignment is an **illustrative multi-source composite**, not a single-subject reconstruction or medical registration. No part is claimed to be a newly validated clinical model. The cerebellum/stem have less fine surface detail than the MRI cortex; Eco intentionally reduces mesh resolution. The complete source notices, hashes, registration transform, and changes are preserved in `licenses/anatomy/` and `public/models/provenance.json`.

Electrical activity remains a UI simulation, not measured neural tracts or cognition. The licensed anatomical surfaces define the shape; the decorative lighting does not substitute for anatomy. Smooth 60 FPS is a target on a suitable desktop GPU, not a physical macOS benchmark completed in this workspace.
