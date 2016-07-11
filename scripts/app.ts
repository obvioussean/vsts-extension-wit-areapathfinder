import {IWorkItemFormService, WorkItemFormService} from "TFS/WorkItemTracking/Services";
import {TeamFinderDialog, ITeamFinderDialogConfiguration} from "dialog";
import Q = require("q");

var actionProvider = {
    getMenuItems: (context) => {
        return [<IContributedMenuItem>{
            title: "Area Path Finder",
            icon: "img/icon-light.png",
            text: "Area Path Finder",
            action: (actionContext) => {
                showDialog();
            }
        }];
    }
};

function showDialog() {
    VSS.getService(VSS.ServiceIds.Dialog).then((dialogService: IHostDialogService) => {
        let extInfo = VSS.getExtensionContext();
        let dialog: IExternalDialog;
        let dialogInstance: TeamFinderDialog;
        let dialogOptions: IHostDialogOptions = {
            title: "Area Path Finder",
            width: 400,
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
                "project": project
            };
            let contributionConfig = {
                properties: properties
            };

            dialogService.openDialog(
                extInfo.publisherId + "." + extInfo.extensionId + ".dialog",
                dialogOptions,
                contributionConfig).then((externalDialog: IExternalDialog) => {
                    dialog = externalDialog;
                    dialog.getContributionInstance("dialog").then((instance: TeamFinderDialog) => {
                        dialogInstance = instance;
                        dialogInstance.initialize();

                        dialogInstance.areaPathChanged((areaPath: string) => {
                            dialog.updateOkButton(true);
                        });
                    }, (reason) => {
                        debugger;
                    });
                });
        });
    });
}

// Register context menu action provider
VSS.register(VSS.getContribution().id, actionProvider);