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
package com.nextgenactionscript.vscode;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

import flash.tools.debugger.ILauncher;

/**
 * If the "launch" command includes runtimeExecutable and (optionally)
 * runtimeArgs fields, we need to launch the SWF runtime manually instead of
 * letting the debugger do it automatically.
 */
public class CustomRuntimeLauncher implements ILauncher
{
    private static final String EXTENSION_APP = ".app";
    private String runtimeExecutable;
    private String[] runtimeArgs;
    public boolean isAIR = false;

    public CustomRuntimeLauncher(String runtimeExecutablePath)
    {
        this(runtimeExecutablePath, null);
    }

    public CustomRuntimeLauncher(String runtimeExecutable, String[] runtimeArgs)
    {
        if (runtimeExecutable.endsWith(EXTENSION_APP))
        {
            //for convenience, we'll automatically dig into .app packages on
            //macOS to find the real executable. easier than documenting the
            //whole "Show Package Contents" thing in Finder.
            Path directoryPath = Paths.get(runtimeExecutable).resolve("./Contents/MacOS");
            File directory = directoryPath.toFile();
            if (directory.exists() && directory.isDirectory())
            {
                File[] files = directory.listFiles();
                if (files.length > 0)
                {
                    runtimeExecutable = files[0].getAbsolutePath();
                }
            }
        }
        this.runtimeExecutable = runtimeExecutable;
        this.runtimeArgs = runtimeArgs;
    }

    public Process launch(String[] cmd) throws IOException
    {
        int baseCount = cmd.length;
        if (!isAIR)
        {
            //for some reason, the debugger always includes the path to ADL in
            //the launch arguments for a custom launcher, but not to Flash
            //Player. we need to account for this difference in length.
            baseCount++;
        }
        int extraCount = 0;
        if (runtimeArgs != null)
        {
            extraCount = runtimeArgs.length;
        }
        String[] finalArgs = new String[baseCount + extraCount];
        finalArgs[0] = runtimeExecutable;
        if (isAIR)
        {
            //as noted above, we ignore the debugger's incorrect path to ADL
            //and start copying from index 1 instead of 0.
            System.arraycopy(cmd, 1, finalArgs, 1, cmd.length - 1);
        }
        else
        {
            System.arraycopy(cmd, 0, finalArgs, 1, cmd.length);
        }
        if (runtimeArgs != null)
        {
            System.arraycopy(runtimeArgs, 0, finalArgs, baseCount, runtimeArgs.length);
        }
        return Runtime.getRuntime().exec(finalArgs);
    }

    public void terminate(Process process) throws IOException
    {
        process.destroy();
    }
}
