// ios-client/SpatialVR/VR/StereoVRContainer.swift
import SwiftUI
import SceneKit
import CoreMotion
import AVFoundation

struct StereoVRContainer: UIViewRepresentable {
    @ObservedObject var streamClient: StreamClient
    @Binding var ipdMm: Float
    @Binding var screenDistance: Float
    @Binding var screenScale: Float
    
    func makeUIView(context: Context) -> UIView {
        let container = UIView(frame: .zero)
        container.backgroundColor = .black
        
        let leftSCNView = SCNView(frame: .zero)
        let rightSCNView = SCNView(frame: .zero)
        
        leftSCNView.translatesAutoresizingMaskIntoConstraints = false
        rightSCNView.translatesAutoresizingMaskIntoConstraints = false
        
        container.addSubview(leftSCNView)
        container.addSubview(rightSCNView)
        
        NSLayoutConstraint.activate([
            leftSCNView.topAnchor.constraint(equalTo: container.topAnchor),
            leftSCNView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            leftSCNView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            leftSCNView.widthAnchor.constraint(equalTo: container.widthAnchor, multiplier: 0.5),
            
            rightSCNView.topAnchor.constraint(equalTo: container.topAnchor),
            rightSCNView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            rightSCNView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            rightSCNView.widthAnchor.constraint(equalTo: container.widthAnchor, multiplier: 0.5)
        ])
        
        context.coordinator.setupViews(left: leftSCNView, right: rightSCNView)
        context.coordinator.startMotion()
        
        return container
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.updateFrame(image: streamClient.latestFrame)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(streamClient: streamClient)
    }
    
    class Coordinator: NSObject {
        var streamClient: StreamClient
        var leftView: SCNView?
        var rightView: SCNView?
        var scene = SCNScene()
        
        var leftCameraNode = SCNNode()
        var rightCameraNode = SCNNode()
        var cameraRig = SCNNode()
        
        var screenNode = SCNNode()
        var screenMaterial = SCNMaterial()
        var motionManager = CMMotionManager()
        
        init(streamClient: StreamClient) {
            self.streamClient = streamClient
        }
        
        func setupViews(left: SCNView, right: SCNView) {
            self.leftView = left
            self.rightView = right
            
            // Build Scene
            let plane = SCNPlane(width: 2.4, height: 1.35)
            plane.cornerRadius = 0.02
            screenMaterial.diffuse.contents = UIColor.darkGray
            screenMaterial.isDoubleSided = true
            plane.materials = [screenMaterial]
            
            screenNode.geometry = plane
            screenNode.position = SCNVector3(x: 0, y: 0, z: -2.2)
            scene.rootNode.addChildNode(screenNode)
            
            // Floor Grid
            let floor = SCNFloor()
            floor.reflectivity = 0.1
            let floorMat = SCNMaterial()
            floorMat.diffuse.contents = UIColor(white: 0.05, alpha: 1.0)
            floor.materials = [floorMat]
            let floorNode = SCNNode(geometry: floor)
            floorNode.position = SCNVector3(x: 0, y: -1.2, z: 0)
            scene.rootNode.addChildNode(floorNode)
            
            // Cameras
            let leftCam = SCNCamera()
            leftCam.zNear = 0.1
            leftCam.zFar = 100
            leftCameraNode.camera = leftCam
            leftCameraNode.position = SCNVector3(x: -0.032, y: 0, z: 0)
            
            let rightCam = SCNCamera()
            rightCam.zNear = 0.1
            rightCam.zFar = 100
            rightCameraNode.camera = rightCam
            rightCameraNode.position = SCNVector3(x: 0.032, y: 0, z: 0)
            
            cameraRig.addChildNode(leftCameraNode)
            cameraRig.addChildNode(rightCameraNode)
            scene.rootNode.addChildNode(cameraRig)
            
            left.scene = scene
            left.pointOfView = leftCameraNode
            left.backgroundColor = .black
            
            right.scene = scene
            right.pointOfView = rightCameraNode
            right.backgroundColor = .black
        }
        
        func startMotion() {
            guard motionManager.isDeviceMotionAvailable else { return }
            motionManager.deviceMotionUpdateInterval = 1.0 / 60.0
            motionManager.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] motion, _ in
                guard let self = self, let motion = motion else { return }
                
                let q = motion.attitude.quaternion
                self.cameraRig.orientation = SCNVector4(x: Float(q.x), y: Float(q.y), z: Float(-q.z), w: Float(q.w))
            }
        }
        
        func updateFrame(image: UIImage?) {
            if let image = image {
                screenMaterial.diffuse.contents = image
            }
        }
    }
}
