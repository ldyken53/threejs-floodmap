from flask import jsonify, Flask, render_template, request, url_for
from vtkmodules.all import (
    vtkTIFFReader,
)

import gc
from vtkmodules.util.numpy_support import vtk_to_numpy
import numpy as np
import json

from topologytoolkit import (
    ttkFTMTree,
    ttkTopologicalSimplificationByPersistence,
    ttkScalarFieldSmoother
)

app = Flask(__name__)
pread = vtkTIFFReader()
pread.SetFileName("./elevation1.tiff")

# extractComponent = vtkImageExtractComponents()
# extractComponent.SetInputConnection(pread.GetOutputPort())
# extractComponent.SetComponents(0)
# extractComponent.Update()

smoother = ttkScalarFieldSmoother()
smoother.SetInputConnection(0, pread.GetOutputPort())
smoother.SetInputArrayToProcess(0, 0, 0, 0, "Tiff Scalars")
smoother.SetNumberOfIterations(5)
smoother.Update()

simplify = ttkTopologicalSimplificationByPersistence()
simplify.SetInputConnection(0, smoother.GetOutputPort())
simplify.SetInputArrayToProcess(0, 0, 0, 0, "Tiff Scalars")
simplify.SetThresholdIsAbsolute(False)
# simplify.SetPersistenceThreshold(50)
# simplify.Update()

tree = ttkFTMTree()
tree.SetInputConnection(0, simplify.GetOutputPort())
tree.SetInputArrayToProcess(0, 0, 0, 0, "Tiff Scalars")
tree.SetTreeType(2)
tree.SetWithSegmentation(1)
# tree.Update()



@app.route('/test', methods=['GET'])
def test():
    response = {}
    # ranges = [0.02, 0.04, 0.06, 0.08, 0.1]
    ranges = [0.02]
    for i in ranges:
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