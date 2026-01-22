/**
 * Diff Tab Content Component
 *
 * Wrapper that adapts TabComponentProps<DiffTabData> to DiffEditor props.
 */

import { DiffEditor } from "./DiffEditor";
import type { TabComponentProps, DiffTabData } from "../../lib/tabs/types";

export function DiffTabContent({ data }: TabComponentProps<DiffTabData>) {
  return (
    <DiffEditor
      original={data.originalContent}
      modified={data.modifiedContent}
      language={data.language}
      path={data.filePath}
    />
  );
}
