import React, { useContext, useEffect, useState } from "react";
import { Paragraph, Button, Stack, Tooltip } from "@contentful/f36-components";
import { Entry, SidebarAppSDK } from "@contentful/app-sdk";
import { useFieldValue, useSDK } from "@contentful/react-apps-toolkit";
import { GrowthbookAPIContext } from "contexts/GrowthbookAPIContext";
import { ExperimentAPIResponse } from "types/experiment";
import Link from "next/link";

const Sidebar = () => {
  const sdk = useSDK<SidebarAppSDK>();

  const { growthbookAPI: growthbookExperimentApi } =
    useContext(GrowthbookAPIContext);

  const [formExperimentName, setFormExperimentName] = useFieldValue<string>(
    sdk.entry.fields.experimentName.id
  );

  const [formFeatureFlagId, setFormFeatureFlagId] = useFieldValue<string>(
    sdk.entry.fields.featureFlagId.id
  );

  const [formTrackingKey, setFormTrackingKey] = useFieldValue<string>(
    sdk.entry.fields.trackingKey.id
  );

  const [formExperiment, setFormExperiment] =
    useFieldValue<ExperimentAPIResponse>(sdk.entry.fields.experiment.id);

  const [experimentId, setExperimentId] = useState(formExperiment?.id || "");

  const [formVariations] = useFieldValue<Entry[]>(
    sdk.entry.fields.variations.id
  );

  const [variationNames] = useFieldValue<string[]>(
    sdk.entry.fields.variationNames.id
  );

  let showUpdateButton = false;

  if (formExperiment && variationNames) {
    const varationNamesFromExperient = formExperiment?.variations.map(
      (variation) => variation.name
    );
    //check if variation names from experiment and variation names from contentful are the same
    showUpdateButton =
      variationNames.join() !== varationNamesFromExperient.join();
  }

  const handleCreate = async () => {
    const trimmedFormExperimentName = formExperimentName?.trim();
    setFormExperimentName(trimmedFormExperimentName);
    if (
      !experimentId &&
      trimmedFormExperimentName &&
      formVariations &&
      variationNames
    ) {
      const slugifiedExperimentName = trimmedFormExperimentName
        .toLowerCase()
        .replace(/\s+/g, "-");
      const featureFlagId = slugifiedExperimentName;
      const trackingKey = slugifiedExperimentName;
      setFormFeatureFlagId(featureFlagId);
      setFormTrackingKey(trackingKey);

      const results = await growthbookExperimentApi?.createExperiment({
        datasourceId: sdk.parameters.installation.datasourceId,
        assignmentQueryId: "user_id",
        trackingKey,
        name: trimmedFormExperimentName,
        variations: formVariations.map((variation, index) => {
          return {
            name: variationNames[index],
            key: index.toString(),
            id: variation.sys.id,
          };
        }),
      });

      if (!results) {
        sdk.notifier.error("Failed to create the experiment on Growthbook");
        return;
      }

      const newExperiment = results["experiment"];
      setExperimentId(newExperiment.id);
      setFormExperiment(newExperiment);

      // need to wait for the experiment for eventually consistency
      setTimeout(() => {
        growthbookExperimentApi?.createFeatureFlag({
          id: featureFlagId,
          owner: "tallnerd@gmail.com",
          valueType: "string",
          defaultValue: "0",
          environments: {
            production: {
              enabled: true,
              rules: [
                {
                  type: "experiment-ref",
                  experimentId: newExperiment.id,
                  enabled: true,
                  variations: newExperiment.variations.map(
                    (variation, index) => {
                      return {
                        variationId: variation.variationId,
                        value: index.toString(),
                      };
                    }
                  ),
                },
              ],
            },
          },
        });
      }, 5000);
    }
  };

  const handleUpdate = async () => {
    setFormExperimentName(formExperimentName?.trim());
    if (
      experimentId &&
      formFeatureFlagId &&
      formTrackingKey &&
      formExperimentName &&
      formVariations &&
      variationNames
    ) {
      // set variation weights to equal split by default
      // users can go to Growthbook to adjust the weights if they want something different
      const updatedPhases = formExperiment?.phases.map((phase) => {
        return {
          ...phase,
          variationWeights: Array.from(
            { length: formVariations.length },
            () => 1 / formVariations.length
          ),
        };
      });

      const results = await growthbookExperimentApi?.updateExperiment(
        experimentId,
        {
          assignmentQueryId: "user_id",
          trackingKey: formTrackingKey,
          name: formExperimentName,
          variations: formVariations.map((variation, index) => {
            return {
              name: variationNames[index],
              key: index.toString(),
              id: variation.sys.id,
            };
          }),
          phases: updatedPhases,
        }
      );

      if (!results) {
        sdk.notifier.error("Failed to update the experiment on Growthbook");
        return;
      }

      const updatedExperiment = results["experiment"];
      setFormExperiment(updatedExperiment);

      growthbookExperimentApi?.updateFeatureFlag(formFeatureFlagId, {
        owner: "tallnerd@gmail.com",
        defaultValue: "0",
        environments: {
          production: {
            enabled: true,
            rules: [
              {
                type: "experiment-ref",
                experimentId: updatedExperiment.id,
                enabled: true,
                variations: updatedExperiment.variations.map(
                  (variation, index) => {
                    return {
                      variationId: variation.variationId,
                      value: index.toString(),
                    };
                  }
                ),
              },
            ],
          },
        },
      });
    }
  };

  const handleStartClick = async () => {
    const results = await growthbookExperimentApi?.updateExperiment(
      experimentId,
      {
        status: "running",
      }
    );
    if (!results) {
      sdk.notifier.error("Failed to start the experiment on Growthbook");
      return;
    }
    const updatedExperiment = results["experiment"];
    setFormExperiment(updatedExperiment);
  };

  const canCreate =
    formExperimentName && formVariations && formVariations.length >= 2;

  return (
    <Stack spacing="spacingS" flexDirection="column" alignItems="flex-start">
      {formExperiment && (
        <>
          <Paragraph>
            Experiment Status:{" "}
            <b>
              {formExperiment.status}
              {showUpdateButton ? ", out of sync" : ""}
            </b>
            <br />
            Tracking Key: <b>{formTrackingKey}</b> <br />
            Feature Flag Id: <b>{formFeatureFlagId}</b> <br />
            <Link
              href={`https://app.growthbook.io/experiment/${experimentId}`}
              target="_blank"
            >
              View Experiment on Growthbook
            </Link>
          </Paragraph>
        </>
      )}
      {!experimentId && (
        <Tooltip
          content={
            !canCreate
              ? "An experiment needs a name and at least two variations."
              : ""
          }
        >
          <Button
            onClick={handleCreate}
            style={{ display: "block", marginBottom: "10px" }}
            isDisabled={!canCreate}
          >
            Create New Experiment
          </Button>
        </Tooltip>
      )}
      {showUpdateButton && (
        <Tooltip
          content={
            formVariations?.length != variationNames?.length
              ? "Create or link an existing entry for each variation."
              : ""
          }
        >
          <Button
            onClick={handleUpdate}
            style={{ display: "block", marginBottom: "10px" }}
            isDisabled={formVariations?.length != variationNames?.length}
          >
            Update Experiment
          </Button>
        </Tooltip>
      )}
      {!showUpdateButton &&
        formExperiment &&
        formExperiment.status != "running" && (
          <Tooltip content="Once you start an experiment and users see it, updating it will invalidate the results.">
            <Button
              onClick={handleStartClick}
              style={{ display: "block", marginBottom: "10px" }}
              isDisabled={formVariations?.length != variationNames?.length}
            >
              Start Experiment
            </Button>
          </Tooltip>
        )}
    </Stack>
  );
};

export default Sidebar;
