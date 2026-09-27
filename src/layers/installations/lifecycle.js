import * as Cesium from 'cesium';
import { LAYER_ID } from './policy.js';
import {
  claimCameraSensitivity,
  releaseCameraSensitivity,
} from '../../data/cameraSensitivity.js';

export function createLifecycle({
  state: layerState,
  services,
  parts,
  source,
}) {
  const { registerPickOwner, unregisterPickOwner } = services.picking;
  const { clearSelectedEntityContextForLayer } = services.context;

  const methods = {
    init(viewer) {
      layerState.viewer = viewer;
      layerState.dataSource = new Cesium.CustomDataSource(
        'military-installations',
      );
      viewer.dataSources.add(layerState.dataSource);
      const cameraChanged = () => {
        if (!layerState.contextAnchor) parts.viewport.scheduleLoad();
      };
      layerState.moveEndRemove =
        viewer.camera.moveEnd.addEventListener(cameraChanged);
      layerState.changedRemove =
        viewer.camera.changed?.addEventListener(cameraChanged);
      parts.selection.installInteraction(viewer);
    },

    enable() {
      layerState.enabled = true;
      parts.namedMarkers?.enable();
      claimCameraSensitivity(layerState.viewer.camera, LAYER_ID, 0.01);
      registerPickOwner(LAYER_ID, (id) => layerState.recordById.has(id));
      layerState.dataSource.show = true;
      // DataLayerManager invokes update() immediately after enable(), which owns
      // the first fetch. Avoid racing it with a second aborting request here.
    },

    disable() {
      layerState.enabled = false;
      parts.namedMarkers?.hide();
      releaseCameraSensitivity(layerState.viewer?.camera, LAYER_ID);
      layerState.contextAnchor = null;
      layerState.contextPosition = null;
      layerState.coverage = { kind: 'viewport' };
      layerState.cameraLoadKey = null;
      layerState.cameraLoadOwner = null;
      unregisterPickOwner(LAYER_ID);
      parts.viewport.clearUnavailableRetry();
      clearTimeout(layerState.timer);
      layerState.abort?.abort();
      layerState.abort = null;
      layerState.loading = false;
      if (layerState.dataSource) layerState.dataSource.show = false;
      clearSelectedEntityContextForLayer(LAYER_ID);
      layerState.selectedId = null;
      layerState.failureReason = null;
      parts.ingestion.setInstallationStatus('idle');
    },

    destroy(viewer) {
      source.destroy?.();
      this.disable();
      layerState.contextAnchor = null;
      layerState.contextPosition = null;
      layerState.coverage = { kind: 'viewport' };
      layerState.moveEndRemove?.();
      layerState.changedRemove?.();
      layerState.clickHandler?.destroy();
      layerState.clickHandler = null;
      parts.namedMarkers?.destroy();
      parts.rendering.clearRendered();
      if (layerState.dataSource && viewer)
        viewer.dataSources.remove(layerState.dataSource, true);
      layerState.dataSource = null;
    },
  };

  return { methods };
}
