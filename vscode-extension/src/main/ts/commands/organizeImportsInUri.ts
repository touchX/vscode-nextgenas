/*
Copyright 2016-2017 Bowler Hat LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import * as vscode from "vscode";
import organizeImportsInTextEditor from "./organizeImportsInTextEditor";

export default function organizeImportsInUri(uri: vscode.Uri, save?: boolean, close?: boolean): Thenable<any>
{
	return vscode.workspace.openTextDocument(uri).then((document: vscode.TextDocument) =>
	{
		return vscode.window.showTextDocument(document).then((editor: vscode.TextEditor) =>
		{
			return editor.edit((edit: vscode.TextEditorEdit) =>
			{
				organizeImportsInTextEditor(editor, edit);
			}).then(() =>
			{
				if(save)
				{
					return editor.document.save().then(() =>
					{
						if(close)
						{
							return vscode.commands.executeCommand("workbench.action.closeActiveEditor");
						}
					});
				}
			});
		});
	});
}