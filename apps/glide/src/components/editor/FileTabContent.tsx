/**
 * File Tab Content Component
 *
 * Wrapper that adapts TabComponentProps<FileTabData> to MonacoEditor props.
 */

import { MonacoEditor } from "./MonacoEditor";
import type { TabComponentProps, FileTabData } from "../../lib/tabs/types";

export function FileTabContent({ data }: TabComponentProps<FileTabData>) {
  return (
    <MonacoEditor
      content={data.currentContent}
      language={data.language}
      path={data.path}
    />
  );
}
