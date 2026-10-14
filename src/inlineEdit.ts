import { InlineEditManager } from "./inlineEdit/inlineEditManager";

export async function runInlineEdit(): Promise<void> {
  await InlineEditManager.getInstance().start();
}

export async function acceptInlineEdit(): Promise<void> {
  await InlineEditManager.getInstance().accept();
}

export function rejectInlineEdit(): void {
  InlineEditManager.getInstance().reject();
}
