# AXIOM anatomical composite — sources, rights, and changes

This model uses licensed anatomical surfaces, not a procedural oval. It is a **multi-source anatomical visualization**, not a single-subject reconstruction or a clinical reference. No endorsement by the source authors or institutions is implied.

## Cerebral cortex — CC0 1.0

- Original data: OpenNeuro **ds006128**, subject `sub-01`, snapshot **1.0.11**. Data for “Modeling 2D Spatio-Tactile Population Receptive Fields of the Fingertip in Human Primary Somatosensory Cortex.” Authors: Susanne Stoll, Falk Luesebrink, D. Samuel Schwarzkopf, Hendrik Mattern, Peng Liu, Johanna Noelle, Esther Kuehn.
- Source dataset and license: https://github.com/OpenNeuroDatasets/ds006128/blob/1.0.11/dataset_description.json (`License: CC0`). DOI: https://doi.org/10.18112/openneuro.ds006128.v1.0.11
- License: **CC0 1.0 Universal** — https://creativecommons.org/publicdomain/zero/1.0/ (legal code: https://creativecommons.org/publicdomain/zero/1.0/legalcode.en).
- Intermediate anatomical data: `unified-cortex` from StarKnightt/Cerebrum's `brain-atlas.glb`, pinned at commit `d778b990dac88c2442ae67b83134537c0883db17`: https://github.com/StarKnightt/brain-explorer/blob/d778b990dac88c2442ae67b83134537c0883db17/public/models/brain-atlas.glb
- Upstream provenance: bilateral FreeSurfer pial surfaces and native cortical curvature; topology-preserving decimation to **150,256 triangles**. AXIOM preserves that Full-detail cortical topology and natural asymmetry, recenters and uniformly scales its coordinates, and retains the native curvature attribute for fold shading. Eco is separately decimated.
- Only anatomical data is used. No source application code, shaders, UI, or styles from Cerebrum are copied. Its lack of a project-wide software license does not grant reuse of that code.

## Cerebellum and brainstem — CC BY 4.0

**BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.**

- Original dataset: BodyParts3D 4.0, IS-A OBJ archive. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Official license grant, updated 2025-02-27: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html. It permits redistribution and derivatives with attribution.
- License: **Creative Commons Attribution 4.0 International** — https://creativecommons.org/licenses/by/4.0/ (legal code: https://creativecommons.org/licenses/by/4.0/legalcode.en).
- Intermediate data: OrganUI's `brain.glb`, pinned at commit `e2f8c172716d8f4e8db6080b7d23f38fabe3add8`: https://github.com/organui/brain-3d/blob/e2f8c172716d8f4e8db6080b7d23f38fabe3add8/public/models/brain.glb
- Meshes used: `cerebellum`, `midbrain`, `pons`, `medulla`. Source FJ identifiers and checksums are retained in `licenses/anatomy/bodyparts-upstream-manifest.json` in the repository.
- Changes by AXIOM: extracted these four anatomical meshes; reflected the X axis to match the MRI convention (with winding/normals corrected); uniformly scaled and translated to align with the cortex; normalized the complete composite; changed display materials; created an Eco decimation; packaged as gzip-compressed GLB. **No ellipsoid, generated gyri, invented cerebellum, or tube stem is used.**
- Legacy OBJ notices mention CC BY-SA 2.1 Japan. We use the official archive's current CC BY 4.0 grant and preserve its dated license-page snapshot and upstream notices in `licenses/anatomy/`.
- BodyParts3D citation: Mitsuhashi et al., “BodyParts3D: 3D structure database for anatomical concepts,” Nucleic Acids Research 37 (2009), D782–D785. https://doi.org/10.1093/nar/gkn613

## Derived files and images

These credits and source-specific terms apply to `brain-full.glb.gz`, `brain-eco.glb.gz`, the surface-network files, anatomy preview images, and dashboard/anatomy screenshots depicting the composite. Keep this attribution and the license links with redistributed model data or derived images. These data licenses do not relicense unrelated application code.

`provenance.json` records source SHA-256 hashes, registration transforms, LOD triangle counts, output hashes, and deterministic network generation. `scripts/build-anatomy.py` is AXIOM's own conversion pipeline. Original input downloads remain outside the committed source under `work/`.

Electrical signals are illustrative application activity on **real cortical mesh edges**, not measured neural pathways, connectivity, cognition, or medical data. The data has been adapted for display, including the composite alignment and Eco simplification. The cerebellum/stem have less fine anatomical detail than the MRI cortex. The composite is not suitable for medical interpretation or treatment planning.
