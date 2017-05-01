import { IWorkItemFormService, WorkItemFormService } from "TFS/WorkItemTracking/Services";
import { TeamFinderDialog, ITeamFinderDialogConfiguration } from "./dialog";
import Q = require("q");

var actionProvider = {
    execute: (context) => {
        showDialog();
    }
};

function showDialog() {
    VSS.getService(VSS.ServiceIds.Dialog).then((dialogService: IHostDialogService) => {
        let extInfo = VSS.getExtensionContext();
        let dialog: IExternalDialog;
        let dialogInstance: TeamFinderDialog;
        let dialogOptions: IHostDialogOptions = {
            title: "Area Path Finder",
            width: 600,
            height: 400,
            getDialogResult: () => {
                return dialogInstance.getSelectedAreaPath();
            },
            okCallback: (areaPath: string) => {
                WorkItemFormService.getService().then((workItemFormService: IWorkItemFormService) => {
                    workItemFormService.setFieldValue("System.AreaPath", areaPath);
                });
            },
            okText: "Select Area Path",
            cancelCallback: () => {
                dialog.close();
            }
        };

        WorkItemFormService.getService().then((workItemFormService: IWorkItemFormService) => {
            return workItemFormService.getFieldValue("System.AreaPath");
        }).then((areaPath: string) => {
            let project: string;
            if (areaPath && areaPath.length > 0) {
                project = areaPath.split("\\")[0];
            }
            else {
                project = VSS.getWebContext().project.name;
            }

            let properties: ITeamFinderDialogConfiguration = {
                project: project,
                areaPathChanged: (areaPath: string) => {
                    dialog.updateOkButton(true);
                }
            };

            dialogService.openDialog(
                extInfo.publisherId + "." + extInfo.extensionId + ".dialog",
                dialogOptions,
                properties).then((externalDialog: IExternalDialog) => {
                    dialog = externalDialog;
                    dialog.getContributionInstance("dialog").then((instance: TeamFinderDialog) => {
                        dialogInstance = instance;
                        dialogInstance.initialize();
                    }, (reason) => {
                        debugger;
                    });
                });
        });
    });
}

// register context menu action provider
VSS.register(VSS.getContribution().id, actionProvider);