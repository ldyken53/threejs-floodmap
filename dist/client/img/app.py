from flask import jsonify, Flask, render_template, request, url_for
from vtkmodules.all import (
    vtkPNGReader,
    vtkPNGWriter,
    vtkImageExtractComponents,
)

import gc
from vtkmodules.util.numpy_support import vtk_to_numpy
import numpy as np
# import cv2 as cv
import json

from topologytoolkit import (
    ttkFTMTree,
    ttkTopologicalSimplificationByPersistence,
)

app = Flask(__name__)
pread = vtkPNGReader()
pread.SetFileName("./elevation.png")

extractComponent = vtkImageExtractComponents()
extractComponent.SetInputConnection(pread.GetOutputPort())
extractComponent.SetComponents(0)
extractComponent.Update()

simplify = ttkTopologicalSimplificationByPersistence()
simplify.SetInputConnection(0, extractComponent.GetOutputPort())
simplify.SetInputArrayToProcess(0, 0, 0, 0, "PNGImage")
# simplify.SetPersistenceThreshold(50)
# simplify.Update()

tree = ttkFTMTree()
tree.SetInputConnection(0, simplify.GetOutputPort())
tree.SetInputArrayToProcess(0, 0, 0, 0, "PNGImage")
tree.SetTreeType(2)
tree.SetWithSegmentation(1)
# tree.Update()



@app.route('/test', methods=['GET'])
def test():
    response = {}
    for i in range(10, 60, 10):
        simplify.SetPersistenceThreshold(i)
        simplify.Update()
        tree.Update()
        test = vtk_to_numpy(tree.GetOutput(2).GetPointData().GetArray(2))
        response[i] = {'array': test.tolist(), "max": int(np.max(test))}
        del test
    payload = jsonify(response)
    payload.headers.add('Access-Control-Allow-Origin', '*')
    return payload

if __name__ == '__main__':
   app.run()