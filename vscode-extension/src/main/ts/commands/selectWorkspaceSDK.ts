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
import * as fs from "fs";
import * as path from "path";
import findSDKName from "../utils/findSDKName";
import validateFrameworkSDK from "../utils/validateFrameworkSDK";
import findSDKInLocalNodeModule from "../utils/findSDKInLocalNodeModule";
import findSDKInFlexHomeEnvironmentVariable from "../utils/findSDKInFlexHomeEnvironmentVariable";
import findSDKsInPathEnvironmentVariable from "../utils/findSDKsInPathEnvironmentVariable";

const COMMAND_GLOBAL_SETTINGS = "workbench.action.openGlobalSettings";
const COMMAND_WORKSPACE_SETTINGS = "workbench.action.openWorkspaceSettings";
const INSTRUCTIONS_SEARCH_PATHS = "Add more SDKs using the nextgenas.sdk.searchPaths setting";
const DESCRIPTION_FLEX_HOME = "FLEX_HOME environment variable";
const DESCRIPTION_PATH = "PATH environment variable";
const DESCRIPTION_CURRENT = "Current SDK";
const DESCRIPTION_EDITOR_SDK = "Editor SDK in Settings";
const DESCRIPTION_FLASH_BUILDER_4_7 = "Flash Builder 4.7";
const DESCRIPTION_FLASH_BUILDER_4_6 = "Flash Builder 4.6";
const DESCRIPTION_USER_DEFINED = "User Defined";
const SEARCH_PATHS_MAC =
[
	{
		path: "/Applications/Adobe Flash Builder 4.7/sdks/",
		description: DESCRIPTION_FLASH_BUILDER_4_7
	},
	{
		path: "/Applications/Adobe Flash Builder 4.6/sdks/",
		description: DESCRIPTION_FLASH_BUILDER_4_6
	},
];
const SEARCH_PATHS_WIN =
[
	{
		path: "C:\\Program Files\\Adobe\\Adobe Flash Builder 4.7 (64 Bit)\\sdks\\",
		description: DESCRIPTION_FLASH_BUILDER_4_7
	},
	{
		path: "C:\\Program Files (x86)\\Adobe\\Adobe Flash Builder 4.6\\sdks\\",
		description: DESCRIPTION_FLASH_BUILDER_4_6
	},
	{
		path: "C:\\Program Files\\Adobe\\Adobe Flash Builder 4.6\\sdks\\",
		description: DESCRIPTION_FLASH_BUILDER_4_6
	},
];

interface SDKQuickPickItem extends vscode.QuickPickItem
{
	custom?: any;
}

function openSettingsForSearchPaths()
{
	let searchPaths = vscode.workspace.getConfiguration("nextgenas").inspect("sdk.searchPaths");
	if(searchPaths.workspaceValue)
	{
		//the search paths have already been defined in this workspace,
		//so that's what we should open.
		vscode.commands.executeCommand(COMMAND_WORKSPACE_SETTINGS);
		vscode.window.showInformationMessage(INSTRUCTIONS_SEARCH_PATHS);
	}
	else if(searchPaths.globalValue)
	{
		//the search paths have already been defined globally,
		//so that's what we should open.
		vscode.commands.executeCommand(COMMAND_GLOBAL_SETTINGS);
		vscode.window.showInformationMessage(INSTRUCTIONS_SEARCH_PATHS);
	}
	else
	{
		//search paths haven't been defined yet, so add a global value
		//and then open the settings
		vscode.workspace.getConfiguration("nextgenas").update("sdk.searchPaths", [], true).then(() =>
		{
			openSettingsForSearchPaths();
		});
	}
}

function addSDKItem(path: string, description: string, items: SDKQuickPickItem[], allPaths: string[], require: boolean): void
{
	if(allPaths.indexOf(path) !== -1)
	{
		//skip duplicate
		return;
	}
	allPaths.push(path);
	let label = findSDKName(path);
	if(label === null)
	{
		//we couldn't find the name of this SDK
		if(!require)
		{
			//if it's not required, skip it
			return;
		}
		label = "Unknown SDK";
	}
	items.push(
	{
		label: label,
		detail: path,
		description: description
	});
}

function checkSearchPath(searchPath: string, description: string, items: SDKQuickPickItem[], allPaths: string[])
{
	if(validateFrameworkSDK(searchPath))
	{
		addSDKItem(searchPath, description, items, allPaths, false);
	}
	else if(fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory())
	{
		let files = fs.readdirSync(searchPath);
		files.forEach((file) =>
		{
			let filePath = path.join(searchPath, file);
			if(validateFrameworkSDK(filePath))
			{
				addSDKItem(filePath, description, items, allPaths, false);
			}
		});
	}
}

function createSearchPathsItem(): SDKQuickPickItem
{
	let item =
	{
		label: "Add more SDKs to this list...",
		description: "Opens User Settings",
		detail: "Define nextgenas.sdk.searchPaths in settings to add more SDKs",
		custom: true
	};
	let searchPaths = vscode.workspace.getConfiguration("nextgenas").inspect("sdk.searchPaths");
	if(searchPaths.workspaceValue)
	{
		item.description = "Opens Workspace Settings";
	}
	return item;
}

export default function selectWorkspaceSDK(): void
{
	if(!vscode.workspace.rootPath)
	{
		vscode.window.showErrorMessage("Cannot change ActionScript SDK because no workspace is currently open.");
		return;
	}
	let allPaths: string[] = [];
	let items: SDKQuickPickItem[] = [];
	//for convenience, add an option to open user settings and define custom SDK paths
	items.push(createSearchPathsItem());
	//start with the current framework and editor SDKs
	let frameworkSDK = <string> vscode.workspace.getConfiguration("nextgenas").get("sdk.framework");
	let editorSDK = <string> vscode.workspace.getConfiguration("nextgenas").get("sdk.editor");
	let addedEditorSDK = false;
	if(frameworkSDK)
	{
		addSDKItem(frameworkSDK, DESCRIPTION_CURRENT, items, allPaths, true);
	}
	else if(editorSDK)
	{
		//for legacy reasons, we fall back to the editor SDK if the framework
		//SDK is not defined.
		addedEditorSDK = true;
		addSDKItem(editorSDK, DESCRIPTION_CURRENT, items, allPaths, true);
	}
	//then search for an SDK that's a locally installed Node.js module
	let nodeModuleSDK = findSDKInLocalNodeModule();
	if(nodeModuleSDK)
	{
		addSDKItem(nodeModuleSDK, "Node Module", items, allPaths, true);
	}
	//if the user has defined search paths for SDKs, include them
	let searchPaths = vscode.workspace.getConfiguration("nextgenas").get("sdk.searchPaths");
	if(Array.isArray(searchPaths))
	{
		searchPaths.forEach((searchPath) =>
		{
			checkSearchPath(searchPath, DESCRIPTION_USER_DEFINED, items, allPaths);
		});
	}
	else if(typeof searchPaths === "string")
	{
		checkSearchPath(searchPaths, DESCRIPTION_USER_DEFINED, items, allPaths);
	}
	//check some common locations where SDKs might exist
	let knownPaths = SEARCH_PATHS_MAC;
	if(process.platform === "win32")
	{
		knownPaths = SEARCH_PATHS_WIN;
	}
	knownPaths.forEach((knownPath) =>
	{
		checkSearchPath(knownPath.path, knownPath.description, items, allPaths);
	});
	//if we haven't already added the editor SDK, do it now
	if(!addedEditorSDK && editorSDK)
	{
		addSDKItem(editorSDK, DESCRIPTION_EDITOR_SDK, items, allPaths, true);
	}
	//check if the FLEX_HOME environment variable is defined
	let flexHome = findSDKInFlexHomeEnvironmentVariable();
	if(flexHome)
	{
		addSDKItem(flexHome, DESCRIPTION_FLEX_HOME, items, allPaths, false);
	}
	//check if any SDKs are in the PATH environment variable
	let paths = findSDKsInPathEnvironmentVariable();
	paths.forEach((sdkPath) =>
	{
		addSDKItem(sdkPath, DESCRIPTION_PATH, items, allPaths, false);
	});
	vscode.window.showQuickPick(items, {placeHolder: "Select an ActionScript SDK for this workspace"}).then((value: SDKQuickPickItem) =>
	{
		if(!value)
		{
			//no new SDK was picked, so do nothing
			return;
		}
		if(typeof value.custom !== "undefined")
		{
			//if the user chose to define a custom SDK, open workspace settings
			openSettingsForSearchPaths();
			return;
		}
		//if they chose an SDK, save it to the workspace settings
		let newFrameworkPath = value.detail;
		vscode.workspace.getConfiguration("nextgenas").update("sdk.framework", newFrameworkPath);
	});
}